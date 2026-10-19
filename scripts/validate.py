#!/usr/bin/env python3
r"""Validate a built tutorial (or the gallery) and optionally take screenshots.

Usage:
    python3 scripts/validate.py <out.html> [--screenshots DIR] [--slides] [--pasos] [--slide N] [--alto PX]

Checks:
  - every viz JSON config (<script type="application/json"> child of .viz) parses; a config cut
    short by a literal "</script" inside it gets a hint to write "<\/" instead
  - every data-viz name has a module registered (Viz.register) in the inlined JS
  - every <section class="slide"> has a non-empty aria-label
  - no remote scripts, images, media or stylesheets except Google Fonts
  - main structural tags are balanced (html.parser)
  - no leftover build placeholders (@@NAME@@)
With --screenshots, headless Chrome captures 390x844 and 1280x800, light and dark
(?theme=dark), with prefers-reduced-motion forced so captures show final states. --slides also
captures every slide with all steps shown (?slide=N&pasos=todos). --pasos captures every
intermediate step of every slide (?slide=N&paso=K, K = 0..steps; the step count is read from the
data-pasos attribute the engine sets on each slide); --slide N limits --slides/--pasos to one slide.
--alto overrides the capture height (useful for the long gallery page).
Exit status 1 when any check fails. Python 3 standard library only.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

BALANCED = {"html", "head", "body", "main", "header", "nav", "section", "div", "table", "ul", "ol",
            "pre", "script", "style", "button", "select", "h1", "h2", "h3", "details", "summary",
            "aside", "figure", "dl"}
FONT_HOSTS = ("https://fonts.googleapis.com", "https://fonts.gstatic.com")
CHROME_CANDIDATES = ("/usr/bin/google-chrome", "google-chrome", "chromium", "chromium-browser")


class Inspector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, attrs, line)
        self.errors = []
        self.warnings = []
        self.vizs = []           # dicts: name, line, json (str|None)
        self.slides = []         # (label, line)
        self.scripts = []        # inline script text
        self.styles = []
        self._capture = None     # ("script"|"style"|"json", buffer, target)

    # helpers
    def _attrs(self, attrs):
        return {k: (v if v is not None else "") for k, v in attrs}

    def handle_starttag(self, tag, attrs):
        a = self._attrs(attrs)
        line = self.getpos()[0]
        classes = a.get("class", "").split()
        if tag == "section" and "slide" in classes:
            self.slides.append((a.get("aria-label", "").strip(), line))
        if "data-viz" in a:
            d = {"name": a["data-viz"].strip(), "line": line, "json": None}
            self.vizs.append(d)
            a["__viz"] = d
        if tag == "script":
            src = a.get("src")
            if src is not None:
                self.errors.append(f"line {line}: external <script src=\"{src}\"> (the file must be self-contained)")
            parent = self.stack[-1] if self.stack else None
            if a.get("type", "").lower() == "application/json":
                target = None
                if parent:
                    target = parent[1].get("__viz")
                self._capture = ("json", [], target)
            elif a.get("type", "text/javascript").lower() in ("", "text/javascript", "module", "application/javascript"):
                self._capture = ("script", [], None)
        elif tag == "style":
            self._capture = ("style", [], None)
        elif tag in ("img", "iframe", "video", "audio", "source", "embed", "object", "track"):
            src = a.get("src") or a.get("data") or ""
            if re.match(r"^(https?:)?//", src):
                self.errors.append(f"line {line}: remote <{tag}> {src}")
        elif tag == "link":
            href = a.get("href", "")
            rel = a.get("rel", "").lower()
            if re.match(r"^(https?:)?//", href) and not href.startswith(FONT_HOSTS):
                self.errors.append(f"line {line}: remote <link rel=\"{rel}\"> {href} (only Google Fonts allowed)")
            elif "stylesheet" in rel and not href.startswith(FONT_HOSTS[0]):
                self.errors.append(f"line {line}: external stylesheet {href} (inline it)")
        if tag in BALANCED:
            self.stack.append((tag, a, line))

    def handle_startendtag(self, tag, attrs):
        # self-closing syntax: do not push
        if tag in BALANCED:
            self.errors.append(f"line {self.getpos()[0]}: <{tag}/> self-closing is not valid HTML")
        else:
            self.handle_starttag(tag, attrs)
            if tag in BALANCED and self.stack and self.stack[-1][0] == tag:
                self.stack.pop()

    def handle_endtag(self, tag):
        line = self.getpos()[0]
        if self._capture and tag in ("script", "style"):
            kind, buf, target = self._capture
            text = "".join(buf)
            if kind == "json":
                if target is not None:
                    target["json"] = text
                else:
                    self.warnings.append(f"line {line}: application/json script outside a .viz")
            elif kind == "script":
                self.scripts.append(text)
            else:
                self.styles.append(text)
            self._capture = None
        if tag not in BALANCED:
            return
        if not self.stack:
            self.errors.append(f"line {line}: </{tag}> without an open tag")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # mismatch: report and try to recover
        open_tags = [t for t, _, _ in self.stack]
        if tag in open_tags:
            while self.stack and self.stack[-1][0] != tag:
                t, _, l = self.stack.pop()
                self.errors.append(f"line {l}: <{t}> is not closed before </{tag}> at line {line}")
            self.stack.pop()
        else:
            self.errors.append(f"line {line}: </{tag}> does not match open <{self.stack[-1][0]}> (line {self.stack[-1][2]})")

    def handle_data(self, data):
        if self._capture:
            self._capture[1].append(data)


def truncated(text):
    """True when a JSON text looks cut short: unbalanced brackets or an open string."""
    depth, in_str, esc = 0, False, False
    for ch in text:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
    return in_str or depth > 0


def inspect(path):
    html = Path(path).read_text(encoding="utf-8")
    p = Inspector()
    p.feed(html)
    p.close()
    errors, warnings, info = list(p.errors), list(p.warnings), []
    for t, _, l in p.stack:
        errors.append(f"line {l}: <{t}> is never closed")

    registered = set()
    for s in p.scripts:
        registered.update(re.findall(r"Viz\.register\(\s*['\"]([a-z0-9-]+)['\"]", s))
    has_engine = any("window.Viz" in s for s in p.scripts)
    if p.vizs and not has_engine:
        errors.append("viz elements found but core/engine.js is not inlined")

    for v in p.vizs:
        if v["name"] not in registered:
            errors.append(f"line {v['line']}: data-viz=\"{v['name']}\" has no registered module in this file "
                          f"(registered: {', '.join(sorted(registered)) or 'none'})")
        if v["json"] is None:
            warnings.append(f"line {v['line']}: data-viz=\"{v['name']}\" has no JSON config child (uses {{}})")
        else:
            try:
                json.loads(v["json"])
            except json.JSONDecodeError as e:
                msg = f"line {v['line']}: invalid JSON config for data-viz=\"{v['name']}\": {e}"
                if truncated(v["json"]):
                    msg += (" -- the config ends early: a literal </script inside the JSON closes the tag. "
                            "Write every </ inside a JSON config as <\\/ (e.g. \"<\\/h1>\"); JSON.parse reads it as </.")
                errors.append(msg)

    for label, line in p.slides:
        if not label:
            errors.append(f"line {line}: <section class=\"slide\"> without aria-label")

    for css in p.styles:
        for m in re.finditer(r"url\(\s*['\"]?((?:https?:)?//[^)'\"]+)", css):
            errors.append(f"remote url() in CSS: {m.group(1)}")
        for m in re.finditer(r"@import\s+(?:url\()?['\"]?([^'\";)]+)", css):
            if not m.group(1).startswith(FONT_HOSTS[0]):
                errors.append(f"@import in CSS: {m.group(1)}")

    for m in re.finditer(r"@@[A-Z_]+@@", html):
        line = html.count("\n", 0, m.start()) + 1
        errors.append(f"line {line}: leftover placeholder {m.group(0)} (run scripts/build.py)")

    info.append(f"slides: {len(p.slides)}")
    info.append(f"viz elements: {len(p.vizs)} ({', '.join(sorted({v['name'] for v in p.vizs})) or 'none'})")
    info.append(f"modules registered: {', '.join(sorted(registered)) or 'none'}")
    info.append(f"size: {Path(path).stat().st_size / 1024:.1f} KB")
    return errors, warnings, info, len(p.slides)


def find_chrome():
    for c in CHROME_CANDIDATES:
        w = shutil.which(c) if not c.startswith("/") else (c if Path(c).exists() else None)
        if w:
            return w
    return None


def screenshot(chrome, url, out, w, h, profile):
    # reduced motion makes captures deterministic: every module renders its final state at once
    cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-prefers-reduced-motion",
           "--no-default-browser-check", f"--user-data-dir={profile}", "--virtual-time-budget=6000",
           f"--window-size={w},{h}", f"--screenshot={out}", url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    return r.returncode == 0 and Path(out).is_file() and Path(out).stat().st_size > 0, r.stderr[-400:]


def step_counts(chrome, url, profile):
    """Steps per slide, from the data-pasos attributes in the DOM after the engine ran."""
    cmd = [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
           f"--user-data-dir={profile}", "--virtual-time-budget=6000", "--dump-dom", url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    return [int(n) for n in re.findall(r'<section[^>]*\bdata-pasos="(\d+)"', r.stdout)]


def take_screenshots(path, outdir, slides, n_slides, alto, pasos=False, only=0):
    chrome = find_chrome()
    if not chrome:
        return ["headless Chrome not found; screenshots skipped"], []
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    base = Path(path).resolve().as_uri()
    stem = Path(path).stem
    sizes = [("mobile", 390, alto or 844), ("desktop", 1280, alto or 800)]
    jobs = []
    for theme in ("light", "dark"):
        for label, w, h in sizes:
            jobs.append((f"{base}?theme={theme}", outdir / f"{stem}-{label}-{theme}.png", w, h))
    wanted = [only] if only else range(1, n_slides + 1)
    if only:
        jobs = []
    if slides and n_slides:
        for i in wanted:
            for label, w, h in sizes:
                jobs.append((f"{base}?theme=light&slide={i}&pasos=todos", outdir / f"{stem}-s{i:02d}-{label}.png", w, h))
    errors, done = [], []
    with tempfile.TemporaryDirectory(prefix="tutorial-chrome-") as tmp:
        if pasos and n_slides:
            counts = step_counts(chrome, base, f"{tmp}/count")
            if len(counts) != n_slides:
                errors.append(f"--pasos: could not read the step count of every slide ({len(counts)} of {n_slides}); "
                              "is core/engine.js current?")
            for i, total in enumerate(counts, 1):
                if i not in wanted:
                    continue
                for k in range(total + 1):
                    for label, w, h in sizes:
                        jobs.append((f"{base}?theme=light&slide={i}&paso={k}",
                                     outdir / f"{stem}-s{i:02d}-p{k:02d}-{label}.png", w, h))

        def run(job_i):
            i, (url, out, w, h) = job_i
            # one profile per worker slot: Chrome locks its user-data-dir
            return screenshot(chrome, url, str(out), w, h, f"{tmp}/p{i % 4}"), out
        # 4 parallel slots; jobs sharing a slot run one after another
        slots = [[] for _ in range(4)]
        for i, j in enumerate(jobs):
            slots[i % 4].append((i, j))
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = [r for rs in pool.map(lambda sl: [run(x) for x in sl], slots) for r in rs]
        for (ok, err), out in sorted(results, key=lambda r: str(r[1])):
            if ok:
                done.append(str(out))
            else:
                errors.append(f"screenshot failed: {out.name}: {err.strip()}")
    return errors, done


def main(argv=None):
    ap = argparse.ArgumentParser(description="Validate a built tutorial HTML.")
    ap.add_argument("file")
    ap.add_argument("--screenshots", metavar="DIR", help="capture PNGs with headless Chrome into DIR")
    ap.add_argument("--slides", action="store_true", help="also capture every slide with all steps shown")
    ap.add_argument("--pasos", action="store_true",
                    help="also capture every intermediate step of every slide (?slide=N&paso=K)")
    ap.add_argument("--slide", type=int, default=0, metavar="N", help="limit --slides/--pasos to slide N (1-based)")
    ap.add_argument("--alto", type=int, default=0, help="capture height in px (default 844 mobile / 800 desktop)")
    a = ap.parse_args(argv)
    if not Path(a.file).is_file():
        print(f"error: {a.file} not found", file=sys.stderr)
        return 2
    errors, warnings, info, n_slides = inspect(a.file)
    shots = []
    if a.screenshots:
        e, shots = take_screenshots(a.file, a.screenshots, a.slides, n_slides, a.alto, a.pasos, a.slide)
        errors += e
    print(f"Validation report: {a.file}")
    for i in info:
        print(f"  · {i}")
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  FAIL  {e}")
    for s in shots:
        print(f"  shot  {s}")
    print("RESULT: " + ("FAIL" if errors else "OK") + f" ({len(errors)} errors, {len(warnings)} warnings)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
