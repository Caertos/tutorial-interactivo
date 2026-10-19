#!/usr/bin/env python3
"""Build one self-contained tutorial HTML from a deck source.

Usage:
    python3 scripts/build.py <deck-source.html> -o <out.html>

The deck source is a copy of assets/esqueleto.html with content. The build finds every
data-viz name used, then replaces the placeholders
    <!-- @@ESTILOS@@ -->  -> <style> core/engine.css + used modules' viz.css </style>
    <!-- @@SCRIPTS@@ -->  -> <script> core/engine.js + used modules' viz.js </script>
Only Google Fonts stays remote. Python 3 standard library only.
"""
import argparse
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
CORE = ASSETS / "core"
VIZ = ASSETS / "viz"
PH_STYLES = "<!-- @@ESTILOS@@ -->"
PH_SCRIPTS = "<!-- @@SCRIPTS@@ -->"


class VizFinder(HTMLParser):
    """Collects data-viz names in document order (ignores comments)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.names = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k == "data-viz" and v and v not in self.names:
                self.names.append(v.strip())


def available_modules():
    return sorted(p.name for p in VIZ.iterdir() if (p / "viz.js").is_file()) if VIZ.is_dir() else []


def find_viz(html):
    f = VizFinder()
    f.feed(html)
    return f.names


def read(p):
    return Path(p).read_text(encoding="utf-8")


def guard(text, closing, label):
    if closing in text.lower():
        raise SystemExit(f"error: {label} contains '{closing}', which would break the inlined block")
    return text


def bundle(names, extra_js=()):
    """Return (css, js) strings: core + the given modules (+ extra JS files)."""
    css = [f"/* core/engine.css */\n{read(CORE / 'engine.css')}"]
    js = [f"/* core/engine.js */\n{read(CORE / 'engine.js')}"]
    for n in names:
        d = VIZ / n
        if (d / "viz.css").is_file():
            css.append(f"/* viz/{n}/viz.css */\n{read(d / 'viz.css')}")
        js.append(f"/* viz/{n}/viz.js */\n{read(d / 'viz.js')}")
    for p in extra_js:
        js.append(f"/* {Path(p).relative_to(ASSETS)} */\n{read(p)}")
    css_s = guard("\n".join(css), "</style", "CSS")
    js_s = guard("\n".join(js), "</script", "JS")
    return css_s, js_s


def check_names(names):
    avail = available_modules()
    unknown = [n for n in names if n not in avail]
    if unknown:
        raise SystemExit(
            "error: unknown viz module(s): " + ", ".join(unknown)
            + "\navailable modules: " + (", ".join(avail) or "(none)")
        )


def build(src, out):
    html = read(src)
    for ph in (PH_STYLES, PH_SCRIPTS):
        if html.count(ph) != 1:
            raise SystemExit(f"error: {src} must contain exactly one placeholder {ph}")
    names = find_viz(html)
    check_names(names)
    css, js = bundle(names)
    html = html.replace(PH_STYLES, "<style>\n" + css + "\n</style>")
    html = html.replace(PH_SCRIPTS, "<script>\n" + js + "\n</script>")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(html, encoding="utf-8")
    size = Path(out).stat().st_size
    print(f"wrote {out} ({size / 1024:.1f} KB)")
    print("modules included: " + (", ".join(names) if names else "(none)"))
    return names


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build a self-contained tutorial HTML.")
    ap.add_argument("source", nargs="?", help="deck source HTML (copy of assets/esqueleto.html)")
    ap.add_argument("-o", "--out", help="output HTML path")
    ap.add_argument("--list", action="store_true", help="list available modules and exit")
    a = ap.parse_args(argv)
    if a.list:
        for n in available_modules():
            meta = VIZ / n / "meta.json"
            t = json.loads(read(meta)).get("titulo", "") if meta.is_file() else ""
            print(f"{n}\t{t}")
        return 0
    if not a.source or not a.out:
        ap.error("source and -o/--out are required")
    build(a.source, a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
