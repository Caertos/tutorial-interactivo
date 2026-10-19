#!/usr/bin/env python3
"""Generate assets/biblioteca.html: a self-contained, live gallery of every visual module
(assets/viz/*/meta.json + demo.html) and of the core components (assets/core/componentes/*.html),
plus references/catalogo.md: the compact index the agent reads instead of the gallery, and the
module table of the root README.md (between <!-- modulos:inicio --> and <!-- modulos:fin -->).

Usage:
    python3 scripts/build_biblioteca.py [-o assets/biblioteca.html] [--catalogo references/catalogo.md] [--readme README.md]

Single source of truth: the gallery inlines core/engine.css, core/engine.js and every
module's viz.css / viz.js exactly as the deck build does. Python 3 standard library only.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402

ASSETS = build.ASSETS
COMPONENTS = ASSETS / "core" / "componentes"
EXAMPLE_JS = [ASSETS / "core" / "ejemplos" / "playground-sum.js"]

GALLERY_CSS = """
/* gallery layout (biblioteca only) */
body.biblio{min-height:100%}
.bb-top{position:sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:1rem;
  padding:.7rem clamp(1rem,4vw,2.5rem); background:var(--bg); border-bottom:1px solid var(--line)}
.bb-top .doc{font-size:.9rem; color:var(--muted)} .bb-top .doc b{color:var(--ink)}
.bb-layout{display:grid; grid-template-columns:230px minmax(0,1fr); gap:2.5rem; max-width:1180px; margin:0 auto; padding:0 clamp(1rem,4vw,2.5rem)}
.bb-index{position:sticky; top:3.6rem; align-self:start; max-height:calc(100vh - 4rem); overflow-y:auto; padding:1.6rem 0 2rem; font-size:.9rem}
.bb-index h2{font-size:.8rem; font-weight:600; letter-spacing:0; color:var(--muted); margin:1.2rem 0 .4rem}
.bb-index h2:first-child{margin-top:0}
.bb-index .bb-ix-h + h2{margin-top:.5rem}
.bb-ix-h{font-size:.85rem; font-weight:800; color:var(--ink); margin:1.4rem 0 .2rem}
.bb-ix-h:first-child{margin-top:0}
.bb-sub{font-size:.9rem; font-weight:600; color:var(--muted); margin:2.2rem 0 0; letter-spacing:0}
.bb-index ul{list-style:none; margin:0; padding:0; display:grid; gap:.15rem}
.bb-index a{color:var(--ink); text-decoration:none; display:block; padding:.2rem .5rem; border-radius:6px}
.bb-index a:hover{background:var(--surface)}
.bb-index a code{font-size:.78rem; color:var(--muted)}
.bb-main{min-width:0; padding:1.6rem 0 4rem}
.bb-intro{max-width:62ch}
.bb-intro h1{font-size:clamp(2rem,5vw,3rem); margin-bottom:.6rem}
.bb-intro pre.code{font-size:.85rem}
.bb-group{font-size:1rem; font-weight:600; color:var(--muted); letter-spacing:0; margin:3rem 0 0; padding-top:1rem; border-top:3px solid var(--ink)}
.bb-entry{padding:2rem 0 2.2rem; border-bottom:1px solid var(--line); scroll-margin-top:4rem}
.bb-entry > header{display:flex; flex-wrap:wrap; align-items:baseline; gap:.4rem 1rem; margin-bottom:.6rem}
.bb-entry > header h2{font-size:clamp(1.4rem,3.5vw,2rem); margin:0}
.bb-entry > header > code{font-size:.85rem; color:var(--muted)}
.bb-forma{list-style:none; display:flex; flex-wrap:wrap; gap:.35rem; margin:0 0 .8rem; padding:0}
.bb-forma li{font-size:.75rem; padding:.1rem .5rem; border-radius:999px; border:1px solid var(--line); color:var(--muted)}
.bb-when{display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:.6rem 2rem; margin:0 0 1rem}
.bb-when h3{font-size:.85rem; color:var(--muted); font-weight:600}
.bb-when p{margin:.2rem 0 0; font-size:.95rem}
.bb-when .no h3{color:var(--err)}
.bb-demo{background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:clamp(.8rem,3vw,1.6rem); min-width:0}
.bb-demo > .viz:first-child{margin-top:0}
.bb-demo .sig{font-size:clamp(2.4rem,9vw,5rem)}
.bb-entry details{margin-top:.8rem}
.bb-entry summary{cursor:pointer; font-weight:600; font-size:.9rem; color:var(--muted)}
.bb-entry summary:hover{color:var(--ink)}
.bb-entry details pre.code{font-size:.78rem; line-height:1.55; max-height:28rem; overflow:auto}
@media (max-width:900px){
  .bb-layout{grid-template-columns:minmax(0,1fr); gap:0}
  .bb-index{position:static; max-height:none; padding:1rem 0 0; border-bottom:1px solid var(--line)}
  .bb-index ul{display:flex; flex-wrap:wrap; gap:.3rem}
  .bb-index a{border:1px solid var(--line); border-radius:999px; padding:.15rem .6rem}
  .bb-index a code{display:none}
}
"""


# Gallery groups by the shape of the idea; modules not listed fall into "Otros".
GROUPS = [
    ("Datos y consultas", ["tabla", "join", "orden-sql"]),
    ("Cantidades y comparaciones", ["grafico", "antes-despues"]),
    ("Ejecución y tiempo", ["maquina", "traza", "linea-tiempo", "memoria"]),
    ("Flujos entre partes", ["capas", "secuencia", "estado"]),
    ("Estructuras", ["arbol", "grafo", "cuadricula"]),
]


def grouped(mods):
    by = {n: (n, m, d) for n, m, d in mods}
    out, used = [], set()
    for title, names in GROUPS:
        items = [by[n] for n in names if n in by]
        used.update(n for n, _, _ in items)
        if items:
            out.append((title, items))
    rest = [x for x in mods if x[0] not in used]
    if rest:
        out.append(("Otros", rest))
    return out


def read(p):
    return Path(p).read_text(encoding="utf-8")


def esc(s):
    return html.escape(s, quote=True)


def load_modules():
    mods = []
    for n in build.available_modules():
        d = build.VIZ / n
        meta_p, demo_p = d / "meta.json", d / "demo.html"
        if not meta_p.is_file() or not demo_p.is_file():
            raise SystemExit(f"error: viz/{n} needs meta.json and demo.html")
        meta = json.loads(read(meta_p))
        for key in ("name", "titulo", "forma", "cuando", "cuandoNo", "config"):
            if key not in meta:
                raise SystemExit(f"error: viz/{n}/meta.json is missing '{key}'")
        if meta["name"] != n:
            raise SystemExit(f"error: viz/{n}/meta.json name '{meta['name']}' does not match its folder")
        mods.append((n, meta, read(demo_p).strip()))
    return mods


def load_components():
    comps = []
    for p in sorted(COMPONENTS.glob("*.html")):
        text = read(p)
        m = re.match(r"\s*<!--\s*(\{.*?\})\s*-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"error: {p.name} must start with a JSON header comment")
        info = json.loads(m.group(1))
        body = text[m.end():].strip()
        cid = re.sub(r"^\d+-", "", p.stem)
        comps.append((cid, info, body))
    return comps


def entry_module(n, meta, demo):
    forma = "".join(f"<li>{esc(f)}</li>" for f in meta["forma"])
    cfg = json.dumps(meta["config"], ensure_ascii=False, indent=2)
    return f"""
<section class="bb-entry" id="viz-{n}" aria-labelledby="t-viz-{n}">
  <header><h2 id="t-viz-{n}">{esc(meta['titulo'])}</h2><code>data-viz="{n}"</code></header>
  <ul class="bb-forma" aria-label="Forma">{forma}</ul>
  <div class="bb-when">
    <div><h3>Cuándo usarlo</h3><p>{esc(meta['cuando'])}</p></div>
    <div class="no"><h3>Cuándo no</h3><p>{esc(meta['cuandoNo'])}</p></div>
  </div>
  <div class="bb-demo" data-stepper>
{demo}
  </div>
  <details><summary>Código para insertarlo</summary><pre class="code">{esc(demo)}</pre></details>
  <details><summary>Todas las opciones de configuración</summary><pre class="code">{esc(cfg)}</pre></details>
</section>"""


def entry_component(cid, info, body):
    return f"""
<section class="bb-entry" id="core-{cid}" aria-labelledby="t-core-{cid}">
  <header><h2 id="t-core-{cid}">{esc(info['titulo'])}</h2><code>núcleo</code></header>
  <div class="bb-when"><div><h3>Cuándo usarlo</h3><p>{esc(info['cuando'])}</p></div></div>
  <div class="bb-demo" data-stepper>
{body}
  </div>
  <details><summary>Código para insertarlo</summary><pre class="code">{esc(body)}</pre></details>
</section>"""


def page(mods, comps):
    names = [n for n, _, _ in mods]
    css, js = build.bundle(names, EXAMPLE_JS)
    groups = grouped(mods)
    idx_mods = "".join(
        f'<h2>{esc(t)}</h2><ul>' + "".join(f'<li><a href="#viz-{n}">{esc(m["titulo"])} <code>{n}</code></a></li>' for n, m, _ in items) + "</ul>"
        for t, items in groups)
    idx_core = "".join(f'<li><a href="#core-{c}">{esc(i["titulo"])}</a></li>' for c, i, _ in comps)
    body_mods = "".join(f'\n    <h3 class="bb-sub">{esc(t)}</h3>' + "".join(entry_module(*m) for m in items) for t, items in groups)
    body_core = "".join(entry_component(*c) for c in comps)
    return f"""<!DOCTYPE html>
<html lang="es">
<!-- GENERATED by scripts/build_biblioteca.py — do not edit by hand; edit assets/viz/* or assets/core/* and rebuild. -->
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Biblioteca de recursos visuales</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
{css}
{GALLERY_CSS}
</style>
</head>
<body class="biblio">
<header class="bb-top">
  <div class="doc">tutorial-interactivo · <b>Biblioteca de recursos visuales</b></div>
  <button class="themebtn" type="button" data-theme-toggle>Tema oscuro</button>
</header>
<div class="bb-layout">
  <nav class="bb-index" aria-label="Índice de la biblioteca">
    <p class="bb-ix-h">Módulos visuales ({len(mods)})</p>{idx_mods}
    <p class="bb-ix-h">Componentes del núcleo</p><ul>{idx_core}</ul>
  </nav>
  <main class="bb-main">
    <div class="bb-intro">
      <h1>Recursos visuales</h1>
      <p class="lead">Cada módulo es una visualización configurable. Elige solo los que tu tutorial necesita: el build incluye el núcleo y únicamente esos módulos.</p>
      <pre class="code">python3 scripts/build.py mi-tutorial.html -o salida.html
python3 scripts/validate.py salida.html --screenshots capturas/</pre>
      <p class="muted">Los módulos con pasos se recorren con «Anterior» y «Siguiente»; dentro de una diapositiva lo hace el «Siguiente» de la navegación, junto a los fragmentos.</p>
    </div>
    <h2 class="bb-group" id="modulos">Módulos visuales ({len(mods)})</h2>
{body_mods}
    <h2 class="bb-group" id="nucleo">Componentes del núcleo ({len(comps)})</h2>
{body_core}
  </main>
</div>
<script>
{js}
</script>
</body>
</html>
"""


def md(s):
    """Make text safe inside a Markdown table cell."""
    return str(s).replace("|", "\\|").replace("\n", " ").strip()


def catalog(mods, comps):
    """Compact Markdown index generated from the same sources as the gallery."""
    formas = {}
    for n, meta, _ in mods:
        for f in meta["forma"]:
            formas.setdefault(f, []).append(n)
    lines = [
        "# Catálogo de recursos visuales",
        "",
        "<!-- GENERATED by scripts/build_biblioteca.py from assets/viz/*/meta.json and assets/core/componentes/*.html."
        " Do not edit by hand: edit those sources and rerun the script. -->",
        "",
        "Índice compacto para elegir recursos en el paso «Plan visual». Léelo en lugar de `assets/biblioteca.html`"
        " (esa galería es para personas y pesa cientos de KB: no la leas). Para cada módulo elegido, lee solo"
        " `assets/viz/<nombre>/meta.json` (todas las opciones) y `assets/viz/<nombre>/demo.html` (un ejemplo real).",
        "",
        "## Índice por forma",
        "",
        "| Forma | Módulos |",
        "|---|---|",
    ]
    lines += [f"| {md(f)} | {', '.join(f'`{n}`' for n in ns)} |" for f, ns in sorted(formas.items(), key=lambda kv: kv[0].casefold())]
    lines += [
        "",
        f"## Módulos visuales ({len(mods)})",
        "",
        'Se insertan con `<div class="viz" data-viz="<nombre>" aria-label="…">` y su configuración JSON'
        " (contrato en `assets/viz/README.md`).",
        "",
        "| Módulo | Qué es | Forma | Cuándo | Cuándo no | Campos de config |",
        "|---|---|---|---|---|---|",
    ]
    for n, meta, _ in mods:
        keys = ", ".join(f"`{k}`" for k in meta["config"])
        lines.append(f"| `{n}` | {md(meta['titulo'])} | {md(', '.join(meta['forma']))} | {md(meta['cuando'])}"
                     f" | {md(meta['cuandoNo'])} | {keys} |")
    lines += [
        "",
        f"## Componentes del núcleo ({len(comps)})",
        "",
        "HTML con clases del núcleo; no necesitan build especial. Copia el fragmento de"
        " `assets/core/componentes/<archivo>` y cambia el contenido.",
        "",
        "| Componente | Archivo | Cuándo |",
        "|---|---|---|",
    ]
    for p, (cid, info, _) in zip(sorted(COMPONENTS.glob("*.html")), comps):
        lines.append(f"| {md(info['titulo'])} | `{p.name}` | {md(info['cuando'])} |")
    return "\n".join(lines) + "\n"


README_START, README_END = "<!-- modulos:inicio -->", "<!-- modulos:fin -->"


def readme_table(mods):
    """Module table for the root README, grouped like the gallery."""
    lines = [README_START,
             "<!-- GENERATED by scripts/build_biblioteca.py from assets/viz/*/meta.json; edit those and rerun. -->",
             "", "| Grupo | Módulo | Qué muestra | Forma |", "|---|---|---|---|"]
    for title, items in grouped(mods):
        for i, (n, meta, _) in enumerate(items):
            lines.append(f"| {md(title) if i == 0 else ''} | `{n}` | {md(meta['titulo'])} | {md(', '.join(meta['forma']))} |")
    lines.append(README_END)
    return "\n".join(lines)


def refresh_readme(path, mods):
    """Replace the marked block of README.md; returns False when the file or the markers are missing."""
    p = Path(path)
    if not p.is_file():
        return False
    text = read(p)
    i, j = text.find(README_START), text.find(README_END)
    if i < 0 or j < i:
        return False
    p.write_text(text[:i] + readme_table(mods) + text[j + len(README_END):], encoding="utf-8")
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(description="Generate the visual resource gallery and the agent catalog.")
    ap.add_argument("-o", "--out", default=str(ASSETS / "biblioteca.html"))
    ap.add_argument("--catalogo", default=str(build.ROOT / "references" / "catalogo.md"),
                    help="compact Markdown index for the agent (default: references/catalogo.md)")
    ap.add_argument("--readme", default=str(build.ROOT / "README.md"),
                    help="README whose module table (between the modulos markers) is refreshed")
    a = ap.parse_args(argv)
    mods, comps = load_modules(), load_components()
    out = Path(a.out)
    out.write_text(page(mods, comps), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
    cat = Path(a.catalogo)
    cat.write_text(catalog(mods, comps), encoding="utf-8")
    print(f"wrote {cat} ({cat.stat().st_size / 1024:.1f} KB)")
    if refresh_readme(a.readme, mods):
        print(f"refreshed module table in {a.readme}")
    else:
        print(f"note: {a.readme} has no {README_START} / {README_END} block; module table not written")
    print(f"modules: {', '.join(n for n, _, _ in mods)}")
    print(f"core components: {', '.join(c for c, _, _ in comps)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
