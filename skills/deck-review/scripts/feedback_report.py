#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Turn ONE deck version's reviewer feedback into an edit work list.

  python feedback_report.py DECK_v1.1.html                      # finds DECK's own versioned JSON next to it
  python feedback_report.py DECK_v1.1.html a.json b.json        # several reviewers of the SAME version
  python feedback_report.py DECK_v1.1.html --json               # machine-readable

Feedback is version-scoped. Only notes written on the version of DECK are used:
files whose deckVersion differs are rejected, and rows from another version are dropped.
Several files of the same version are merged with the browser's rule: newest note per slide key wins,
and anything older than a "clearedAt" watermark is dropped.
"""
import argparse, json, re, sys
from datetime import datetime
from pathlib import Path


def ts(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def read_json_script(s, sid):
    m = re.search(r'<script[^>]*\bid="%s"[^>]*>(.*?)</script>' % sid, s, re.S)
    return json.loads(m.group(1)) if m else None


def fill(template, deck_id, version):
    return template.replace("{deckId}", deck_id).replace("{version}", version)


def load(files, deck_id, version):
    """Return (merged rows, per-file notes). Raises SystemExit if no file matches the version."""
    docs, notes = [], []
    for f in files:
        d = json.loads(Path(f).read_text(encoding="utf-8-sig"))
        name = Path(f).name
        if d.get("deckId") != deck_id:
            notes.append(f"skip {name}: deckId={d.get('deckId')!r}, deck is {deck_id!r}")
            continue
        if d.get("deckVersion") != version:
            notes.append(f"skip {name}: feedback for {d.get('deckVersion')!r}, deck is {version!r} (only same-version feedback is applied)")
            continue
        docs.append((name, d))
    if not docs:
        sys.exit("feedback_report: no feedback file for this version.\n  " + "\n  ".join(notes))
    cleared = max(ts(d.get("clearedAt") or "") for _, d in docs)
    rows, dropped = {}, 0
    for name, d in docs:
        for r in d.get("slides", []):
            if r.get("deckVersion", version) != version:
                dropped += 1
                continue
            if ts(r["updatedAt"]) <= cleared:
                continue
            old = rows.get(r["slideId"])
            if not old or ts(r["updatedAt"]) > ts(old["updatedAt"]):
                rows[r["slideId"]] = {**r, "_file": name}
    if dropped:
        notes.append(f"dropped {dropped} row(s) written on another version")
    return rows, [n for n, _ in docs], notes


REGION = re.compile(r"\[(?:수정할 영역|Region to edit)\](.*?)(?:\n(?:수정 요청|Request):[ \t]*(.*?))(?=\n\[(?:수정할 영역|Region to edit)\]|\Z)", re.S)


def regions(text):
    out = []
    for m in REGION.finditer(text):
        body, ask = m.group(1), m.group(2).strip()
        g = lambda *keys: next((x.group(1).strip() for k in keys for x in [re.search(r"\n%s:\s*(.*)" % re.escape(k), body)] if x), "")
        pos = re.search(r"\n(?:원본 위치|Position)\([^)]*\):\s*(.*)", body)
        out.append({"selector": g("영역 선택자", "Selector"), "type": g("종류", "Type"), "current": g("현재 내용", "Current content"),
                    "position": pos.group(1).strip() if pos else "", "request": ask})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck"); ap.add_argument("feedback", nargs="*")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    path = Path(a.deck); s = path.read_text(encoding="utf-8")
    cfg, meta = read_json_script(s, "deck-review-config"), read_json_script(s, "deck-meta")
    if not cfg or not meta:
        sys.exit("feedback_report: deck has no review shell config/meta; run apply_shell.py first")
    deck_id, version = cfg["deckId"], cfg["version"]
    expected = fill(cfg.get("feedbackFile") or "{deckId}_{version}_feedback.json", deck_id, version)
    files = a.feedback
    if not files:
        cand = path.parent / expected
        if not cand.exists():
            sys.exit(f"feedback_report: {expected} not found next to the deck.\n"
                     f"  Reviewers save feedback for {version} under that name; pass the path(s) explicitly if it lives elsewhere.")
        files = [str(cand)]
    rows, used, notes = load(files, deck_id, version)
    for n in notes:
        print("note: " + n, file=sys.stderr)

    order = {x["id"]: x for x in meta["slides"]}
    items = []
    for k, r in rows.items():
        if not r.get("text", "").strip():
            continue
        m = order.get(k)
        items.append({"slideId": k, "number": m["number"] if m else None, "title": m["title"] if m else r.get("slideTitle"),
                      "orphan": m is None, "updatedAt": r["updatedAt"], "file": r["_file"],
                      "text": r["text"].strip(), "regions": regions(r["text"])})
    items.sort(key=lambda x: (x["orphan"], x["number"] or 999))
    if a.json:
        print(json.dumps({"deckId": deck_id, "feedbackVersion": version, "files": used, "items": items}, ensure_ascii=False, indent=1)); return

    print(f"# Feedback work list · {cfg.get('title') or deck_id} · {version} feedback\n")
    print(f"- source deck: {path.name} ({version}) — apply these notes to the NEXT version file")
    print(f"- feedback files ({version} only): " + ", ".join(used))
    print(f"- {len(items)} slide(s) with notes" + (" · orphan = slide key not in this deck" if any(i["orphan"] for i in items) else "") + "\n")
    for i in items:
        print(f"## [{i['number']:02d}] {i['title']}" if not i["orphan"] else f"## [orphan] {i['title'] or i['slideId']}")
        print(f"- key: `{i['slideId']}` · {i['updatedAt']}" + (f" · from {i['file']}" if len(used) > 1 else ""))
        for g in i["regions"]:
            print(f"- region `{g['selector']}` ({g['type']}) — current: “{g['current'][:120]}”")
            if g["request"]: print(f"  - request: {g['request']}")
        free = REGION.sub("", i["text"]).strip()
        if free:
            print("- note:"); print("\n".join("  > " + ln for ln in free.splitlines()))
        print()


if __name__ == "__main__":
    main()
