#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Headless layout check: elements spilling outside the slide and clipped (overflowing) text boxes.

  python check_deck.py DECK.html [--json] [--slides 3,5] [--browser PATH]

Exit code 1 when any issue is found, so it can gate a release. Requires the review shell
(the shell measures in the page via ?rv-check and Chrome --dump-dom returns the result).
"""
import argparse, html, json, re, subprocess, sys, tempfile
from pathlib import Path
from _browser import find_browser, base_args


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck"); ap.add_argument("--json", action="store_true"); ap.add_argument("--browser")
    ap.add_argument("--slides", help="comma list of slide numbers to report"); ap.add_argument("--wait-ms", type=int, default=8000)
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    src = Path(a.deck).resolve()
    with tempfile.TemporaryDirectory(prefix="deck-review-") as prof:
        cmd = base_args(find_browser(a.browser), prof) + ["--window-size=1920,1080", f"--virtual-time-budget={a.wait_ms}",
                                                           "--dump-dom", src.as_uri() + "?rv-check"]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    m = re.search(r'<script type="application/json" id="rv-check-result">(.*?)</script>', r.stdout, re.S)
    if not m:
        sys.exit("check_deck: no result. Is the review shell installed (apply_shell.py)? Try a larger --wait-ms.")
    res = json.loads(html.unescape(m.group(1)) if m.group(1).lstrip().startswith("{&") else m.group(1))
    only = {int(x) for x in a.slides.split(",")} if a.slides else None
    slides = [s for s in res["slides"] if not only or s["number"] in only]
    if a.json:
        print(json.dumps({**res, "slides": slides}, ensure_ascii=False, indent=1))
    else:
        bad = [s for s in slides if s["issues"]]
        print(f"{res['deckId']} {res['version']} · {res['slideCount']} slides · {len(bad)} with issues")
        for s in bad:
            print(f"\n[{s['number']:02d}] {s['title']}  (key={s['slideId']})")
            for i in s["issues"]:
                if i["kind"] == "outside":
                    o = i["over"]; side = ", ".join(f"{k}+{v}px" for k, v in o.items() if v > 2)
                    print(f"  outside  {side:<18} {i['selector']}  “{i['text']}”")
                elif i["kind"] == "clipped":
                    print(f"  clipped  {i['hidden']:>4}px hidden    {i['selector']}  “{i['text']}”")
                else:
                    print(f"  {i['kind']}  {i.get('note','')}")
    sys.exit(1 if any(s["issues"] for s in slides) else 0)


if __name__ == "__main__":
    main()
