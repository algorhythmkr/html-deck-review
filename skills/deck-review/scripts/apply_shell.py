#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Install or update the deck-review shell (feedback panel + bottom toolbar) in an HTML slide deck.

  python apply_shell.py DECK.html -o DECK_v1.1.html [options]
  python apply_shell.py DECK.html --in-place [--backup-dir DIR]

Idempotent: everything the shell owns lives between <!-- deck-review:begin X --> / <!-- deck-review:end X -->
markers, so re-running replaces it. Existing config and deck-meta (per-slide sources) are preserved unless overridden.

Feedback is version-scoped: the feedback file name and browser storage key contain {version}, so every
new deck version opens with an empty panel and saves to its own JSON (e.g. my-deck_v1.2_feedback.json).
A legacy inline viewer (aside.feedback-panel / nav.controls / its <script>) is detected and removed; its
deckId and feedback file name (with _{version} inserted) are carried over.
"""
import argparse, html, json, os, re, shutil, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
SHELL_VERSION = "1.4.0"


def block(name, body):
    return f"<!-- deck-review:begin {name} -->\n{body}\n<!-- deck-review:end {name} -->"


def strip_blocks(s):
    return re.sub(r"\n?<!-- deck-review:begin (\w[\w-]*) -->.*?<!-- deck-review:end \1 -->\n?", "\n", s, flags=re.S)


def find_json_script(s, sid):
    m = re.search(r'<script[^>]*\bid="%s"[^>]*>(.*?)</script>' % re.escape(sid), s, re.S)
    if not m:
        return None, None
    try:
        return m, json.loads(m.group(1))
    except json.JSONDecodeError:
        return m, None


def remove_element(s, open_re, tag):
    """Remove the first element matching open_re, balancing nested <tag> (good enough for flat chrome markup)."""
    m = re.search(open_re, s)
    if not m:
        return s, False
    depth, pos = 1, m.end()
    tok = re.compile(r"<(/?)%s\b[^>]*>" % tag, re.I)
    while depth:
        t = tok.search(s, pos)
        if not t:
            return s, False
        depth += -1 if t.group(1) else 1
        pos = t.end()
    return s[: m.start()] + s[pos:], True


def strip_legacy(s, log):
    """Remove an older hand-rolled viewer; return (html, carried-over settings)."""
    carry = {}
    scripts = list(re.finditer(r"<script(?![^>]*application/json)[^>]*>(.*?)</script>", s, re.S))
    for m in scripts:
        body = m.group(1)
        if "feedbackText" in body and "deck-meta" in body:
            k = re.search(r"KEY\s*=\s*'([^']+)'", body)
            f = re.search(r"suggestedName:\s*'([^']+)'", body)
            d = re.search(r"DECK\s*=\s*'([^']+)'", body)
            if f: carry["feedbackFile"] = f.group(1)
            if d: carry["deckId"] = d.group(1)
            s = s.replace(m.group(0), "", 1)
            log.append("legacy viewer <script> removed")
            break
    for open_re, tag, label in [
        (r'<aside\b[^>]*class="feedback-panel"[^>]*>', "aside", "aside.feedback-panel"),
        (r'<nav\b[^>]*class="controls"[^>]*>', "nav", "nav.controls"),
        (r'<dialog\b[^>]*id="clearDialog"[^>]*>', "dialog", "dialog#clearDialog"),
    ]:
        s, ok = remove_element(s, open_re, tag)
        if ok: log.append(f"legacy {label} removed")
    for pat, label in [
        (r'<div class="sr-only" id="announcement"[^>]*></div>', "#announcement"),
        (r'<div class="toast" id="toast"[^>]*></div>', "#toast"),
        (r'<style id="feedback-v\w*">.*?</style>', "feedback style"),
        (r'<style id="pagerule">.*?</style>', "@page rule"),
        (r"<noscript>\s*<div class=\"no-js\">.*?</noscript>", "noscript"),
    ]:
        s, n = re.subn(pat, "", s, count=1, flags=re.S)
        if n: log.append(f"legacy {label} removed")
    return s, carry


def iter_slide_tags(s, selector):
    """Yield (match) for start tags matching a simple selector: .cls | tag.cls | tag | [attr]."""
    m = re.fullmatch(r"(\w+)?(?:\.([\w-]+))?(?:\[([\w-]+)\])?", selector.strip())
    if not m or not any(m.groups()):
        sys.exit(f"apply_shell: --slide-selector '{selector}' is too complex; use .class, tag.class or [attr]")
    tag, cls, attr = m.groups()
    for t in re.finditer(r"<(%s)\b([^>]*)>" % (tag or r"[a-zA-Z][\w-]*"), s):
        attrs = t.group(2)
        if cls:
            c = re.search(r'\bclass="([^"]*)"', attrs)
            if not c or cls not in c.group(1).split():
                continue
        if attr and not re.search(r"\b%s(=|\s|$)" % re.escape(attr), attrs):
            continue
        yield t


def text_of(fragment):
    t = re.sub(r"<(style|script)\b.*?</\1>", " ", fragment, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def ensure_slide_keys(s, selector, log):
    """Give every slide a stable data-slide-key and data-title; return (html, [(key, id, title)])."""
    out, info, last, used = [], [], 0, set()
    tags = list(iter_slide_tags(s, selector))
    for n, t in enumerate(tags, 1):
        attrs = t.group(2)
        sid = re.search(r'\bid="([^"]+)"', attrs)
        key = re.search(r'\bdata-slide-key="([^"]+)"', attrs)
        title = re.search(r'\bdata-title="([^"]*)"', attrs)
        add = ""
        if not sid:
            new_id = f"slide-{n:02d}"
            add += f' id="{new_id}"'
            sid_v = new_id
        else:
            sid_v = sid.group(1)
        key_v = key.group(1) if key else sid_v
        if key_v in used:
            sys.exit(f"apply_shell: duplicate data-slide-key '{key_v}' — slide keys must be unique")
        used.add(key_v)
        if not key:
            add += f' data-slide-key="{html.escape(key_v)}"'
        if title:
            title_v = html.unescape(title.group(1))
        else:
            end = tags[n].start() if n < len(tags) else len(s)
            frag = s[t.end(): end]
            h = re.search(r"<(h1|h2|h3)\b[^>]*>(.*?)</\1>|<[^>]+class=\"[^\"]*\b(?:ttl|title)\b[^\"]*\"[^>]*>(.*?)</", frag, re.S)
            title_v = text_of(h.group(2) or h.group(3)) if h else key_v
            add += f' data-title="{html.escape(title_v)}"'
        if add:
            out.append(s[last: t.end() - 1] + add + ">")
            last = t.end()
        info.append((key_v, sid_v, title_v))
    out.append(s[last:])
    if not info:
        sys.exit(f"apply_shell: no slides match selector '{selector}'")
    if last:
        log.append("added missing id / data-slide-key / data-title to slides")
    return "".join(out), info


def versioned_name(name):
    """Make a feedback file name version-scoped: 'x_feedback.json' -> 'x_{version}_feedback.json'."""
    if "{version}" in name:
        return name
    stem = name[:-5] if name.lower().endswith(".json") else name
    if stem.lower().endswith("_feedback"):
        return stem[:-9] + "_{version}_feedback.json"
    return stem + "_{version}.json"


def fill(template, cfg):
    return template.replace("{deckId}", cfg["deckId"]).replace("{version}", cfg["version"])


def version_from_name(path):
    m = re.search(r"_v(\d+(?:\.\d+)*[a-z]?)(?=[_.\-\s]|$)", Path(path).stem, re.I)
    return "v" + m.group(1) if m else None


def slug(name):
    base = re.sub(r"_v\d+(?:\.\d+)*[a-z]?.*$", "", Path(name).stem, flags=re.I)
    s = re.sub(r"[^0-9A-Za-z가-힣]+", "-", base).strip("-").lower()
    return s[:60] or "deck"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("-o", "--out", help="output HTML path (a new version file)")
    g.add_argument("--in-place", action="store_true", help="overwrite DECK after backing it up")
    ap.add_argument("--backup-dir", help="backup folder for --in-place (default: <deck dir>/temp/deck-review-backup)")
    ap.add_argument("--config", help="JSON file merged into the shell config")
    ap.add_argument("--deck-id"); ap.add_argument("--version", dest="ver"); ap.add_argument("--title")
    ap.add_argument("--lang", choices=["auto", "ko", "en"], help="review UI language (default auto: follows <html lang>)"); ap.add_argument("--feedback-file"); ap.add_argument("--brand")
    ap.add_argument("--print-size", choices=["16:9", "a4"]); ap.add_argument("--slide-selector")
    ap.add_argument("--slide-size", help="WxH in px, e.g. 1280x720"); ap.add_argument("--panel-guide")
    ap.add_argument("--panel-closed", action="store_true", help="start with the feedback panel closed")
    ap.add_argument("--no-pick-insert", action="store_true", help="clicking a region only copies it to the clipboard instead of inserting it into the feedback box")
    ap.add_argument("--no-lang-switch", action="store_true", help="hide the KO/EN switch in the toolbar (UI stays in --lang)")
    ap.add_argument("--lang-switch", action="store_true", help="show the KO/EN switch again after --no-lang-switch")
    ap.add_argument("--no-strip-legacy", action="store_true")
    a = ap.parse_args()

    src = Path(a.deck)
    s = src.read_text(encoding="utf-8")
    log = []

    # existing config (re-run) or legacy carry-over
    cm, cfg = find_json_script(s, "deck-review-config")
    cfg = dict(cfg or {})
    _, meta = find_json_script(s, "deck-meta")
    s = strip_blocks(s)
    if not a.no_strip_legacy:
        s, carry = strip_legacy(s, log)
        for k, v in carry.items():
            cfg.setdefault(k, v)
    if a.config:
        cfg.update(json.loads(Path(a.config).read_text(encoding="utf-8")))

    # drop any leftover copies outside our markers (legacy viewer); we re-emit them inside the js block
    s = re.sub(r'<script[^>]*\bid="(deck-meta|feedback-seed|deck-review-config)"[^>]*>.*?</script>', "", s, flags=re.S)
    out_path = Path(a.out) if a.out else src

    title_tag = re.search(r"<title>(.*?)</title>", s, re.S)
    cfg["deckId"] = a.deck_id or cfg.get("deckId") or (meta or {}).get("deckId") or slug(src.name)
    cfg["version"] = a.ver or version_from_name(out_path) or cfg.get("version") or (meta or {}).get("version") or "v1"
    if a.title is not None: cfg["title"] = a.title
    if "title" not in cfg:
        t = html.unescape(title_tag.group(1)).strip() if title_tag else ""
        # the panel shows the version separately, so drop "v4.2"-style tokens from the <title>
        cfg["title"] = re.sub(r"\s*[·|\-–—]?\s*\bv\d+(?:\.\d+)*[a-z]?\b", "", t, flags=re.I).strip(" ·|-")
    for k, v in [("lang", a.lang), ("feedbackFile", a.feedback_file), ("brand", a.brand), ("slideSelector", a.slide_selector), ("panelGuide", a.panel_guide)]:
        if v is not None: cfg[k] = v
    if a.print_size: cfg.setdefault("print", {})["size"] = a.print_size
    if a.slide_size:
        w, h = (int(x) for x in a.slide_size.lower().split("x")); cfg["slideWidth"], cfg["slideHeight"] = w, h
    if a.panel_closed: cfg["panelOpen"] = False
    if a.no_pick_insert: cfg["pickInsert"] = False
    if a.no_lang_switch: cfg["langSwitch"] = False
    if a.lang_switch: cfg["langSwitch"] = True
    cfg.setdefault("lang", "auto"); cfg.setdefault("langSwitch", True); cfg.setdefault("slideSelector", ".slide")
    # version-scoped feedback: file name and storage key always carry {version}
    fb = cfg.get("feedbackFile") or "{deckId}_{version}_feedback.json"
    if versioned_name(fb) != fb:
        log.append(f"feedbackFile '{fb}' -> '{versioned_name(fb)}' (feedback is now per version)")
    cfg["feedbackFile"] = versioned_name(fb)
    if cfg.get("storageKey") and "{version}" not in cfg["storageKey"]:
        log.append(f"storageKey '{cfg.pop('storageKey')}' dropped (browser storage is now per version)")
    cfg["shellVersion"] = SHELL_VERSION

    s, slides = ensure_slide_keys(s, cfg["slideSelector"], log)

    # deck-meta: refresh numbers/titles from the DOM, keep per-slide sources
    old = {x.get("id"): x for x in (meta or {}).get("slides", [])}
    new_meta = {"deckId": cfg["deckId"], "version": cfg["version"],
                "slides": [{"id": k, "number": i, "title": t, "sources": old.get(k, {}).get("sources", [])} for i, (k, _, t) in enumerate(slides, 1)]}
    stray = [x for x in (meta or {}).get("slides", []) if x.get("id") not in {k for k, _, _ in slides}]
    if stray: log.append("deck-meta: dropped slides no longer in the deck: " + ", ".join(x["id"] for x in stray))

    css = (ASSETS / "review-shell.css").read_text(encoding="utf-8")
    js = (ASSETS / "review-shell.js").read_text(encoding="utf-8")
    jdump = lambda o: json.dumps(o, ensure_ascii=False, indent=1).replace("</", "<\\/")
    head_block = block("css", f'<style id="deck-review-css">\n{css}</style>')
    body_block = block("js", "\n".join([
        f'<script type="application/json" id="deck-review-config">{jdump(cfg)}</script>',
        f'<script type="application/json" id="deck-meta">{jdump(new_meta)}</script>',
        f"<script id=\"deck-review-js\">\n{js}</script>"]))

    if "</head>" not in s or "</body>" not in s:
        sys.exit("apply_shell: the deck needs explicit </head> and </body> tags")
    s = s.replace("</head>", head_block + "\n</head>", 1)
    i = s.rfind("</body>")
    s = s[:i] + body_block + "\n" + s[i:]
    s = re.sub(r"\n{3,}", "\n\n", s)

    if a.in_place:
        bdir = Path(a.backup_dir) if a.backup_dir else src.parent / "temp" / "deck-review-backup"
        bdir.mkdir(parents=True, exist_ok=True)
        bak = bdir / f"{src.stem}.{time.strftime('%Y%m%d_%H%M%S')}{src.suffix}"
        shutil.copy2(src, bak); log.append(f"backup: {bak}")
    out_path.write_text(s, encoding="utf-8", newline="")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"deck-review shell {SHELL_VERSION} -> {out_path}")
    print(f"  deckId={cfg['deckId']}  version={cfg['version']}  slides={len(slides)}")
    print(f"  feedback file for this version: {fill(cfg['feedbackFile'], cfg)}  (panel starts empty)")
    for line in log: print("  - " + line)


if __name__ == "__main__":
    main()
