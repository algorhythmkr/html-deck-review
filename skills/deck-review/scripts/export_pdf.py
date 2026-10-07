#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Export a deck that has the review shell to a borderless vector PDF (one slide per page).

  python export_pdf.py DECK.html [-o DECK.pdf] [--browser PATH]

Uses the same @media print rules as the toolbar's "Print / PDF" button, so the file matches what
reviewers get from the browser. Page size comes from the deck config (16:9 by default, or A4).
"""
import argparse, subprocess, sys, tempfile, time
from pathlib import Path
from _browser import find_browser, base_args


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck"); ap.add_argument("-o", "--out"); ap.add_argument("--browser")
    ap.add_argument("--wait-ms", type=int, default=8000, help="virtual time budget for fonts/scripts")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    src = Path(a.deck).resolve()
    out = Path(a.out).resolve() if a.out else src.with_suffix(".pdf")
    if 'id="deck-review-js"' not in src.read_text(encoding="utf-8", errors="ignore"):
        sys.exit("export_pdf: this deck has no review shell; run apply_shell.py first")
    with tempfile.TemporaryDirectory(prefix="deck-review-") as prof:
        cmd = base_args(find_browser(a.browser), prof) + [
            "--run-all-compositor-stages-before-draw", f"--virtual-time-budget={a.wait_ms}",
            "--no-pdf-header-footer", "--print-to-pdf-no-header", f"--print-to-pdf={out}", src.as_uri() + "?present"]
        t = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    if not out.exists() or out.stat().st_size == 0:
        sys.exit("export_pdf: browser did not write the PDF\n" + (r.stderr or "")[-2000:])
    print(f"PDF -> {out}  ({out.stat().st_size/1e6:.2f} MB, {time.time()-t:.1f}s)")


if __name__ == "__main__":
    main()
