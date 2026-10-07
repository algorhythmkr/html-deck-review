# -*- coding: utf-8 -*-
"""Locate a Chromium-based browser (Chrome / Edge / Chromium) for headless runs."""
import os, shutil, sys

CANDIDATES = {
    "win32": [
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
        r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
    ],
    "darwin": [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
}
NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome", "msedge"]


def find_browser(explicit=None):
    if explicit:
        return explicit
    env = os.environ.get("DECK_REVIEW_BROWSER") or os.environ.get("CHROME_PATH")
    if env and os.path.exists(env):
        return env
    for p in CANDIDATES.get(sys.platform, []):
        p = os.path.expandvars(p)
        if os.path.exists(p):
            return p
    for n in NAMES:
        p = shutil.which(n)
        if p:
            return p
    sys.exit("No Chrome/Edge/Chromium found. Set DECK_REVIEW_BROWSER=/path/to/chrome or pass --browser.")


def base_args(browser, profile_dir):
    return [browser, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            "--allow-file-access-from-files", "--hide-scrollbars", f"--user-data-dir={profile_dir}"]
