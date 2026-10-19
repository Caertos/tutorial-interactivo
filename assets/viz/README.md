# Visual module contract (`assets/viz/`)

This file is authoritative for anyone adding a module. A module is a folder
`assets/viz/<name>/` that the build inlines only when a deck uses `data-viz="<name>"`.

## 1. Folder layout

| File | Required | Content |
|---|---|---|
| `viz.js` | yes | One `Viz.register('<name>', {...})` call. No other globals. |
| `viz.css` | yes (may be empty) | Styles scoped to the module's own class prefix. |
| `meta.json` | yes | Gallery metadata, see §6. `name` must equal the folder name. |
| `demo.html` | yes | One realistic embed (`<div class="viz" ...>` + JSON), Spanish content. |
| `demo-datos.sql` (or similar) | when data comes from a real engine | Provenance: the exact queries and their output. |

`<name>` is kebab-case ASCII (`[a-z0-9-]+`). After adding or changing a module run
`python3 scripts/build_biblioteca.py` and validate `assets/biblioteca.html` (§8).

## 2. Embedding in a deck

```html
<div class="viz" data-viz="join" aria-label="What the visualization shows, in one sentence">
  <script type="application/json">{ "...": "module config" }</script>
</div>
```

- The config is the first `<script type="application/json">` child (never an attribute: no quote escaping).
- Write every `</` inside the JSON as `<\/` (`"<\/h1>"`, `"<\/script>"`). A literal `</script` closes the
  tag early and the rest of the config becomes page text; `JSON.parse` reads `<\/` back as `</`.
  `validate.py` reports a config that ends early with this hint.
- `aria-label` is required; it describes the visualization for screen readers.
- The engine adds the class `viz-<name>`, then appends `.viz-body` (your render target) and
  `.viz-bar` (step caption `.viz-cap` with `aria-live="polite"` + a «Repetir» button).
- The root gets `.has-steps` when `steps > 0` (the caption area is always shown then).

## 3. Registry API (`core/engine.js`)

```js
Viz.register(name, {
  render(el, cfg, api) {        // el = .viz-body, cfg = parsed JSON (or {}), called once per element
    /* build DOM inside el */
    return {                     // the instance; every member is optional
      steps: 3,                  // int >= 0, or a getter if it can change (see stepsChanged)
      setStep(n, ctx) {},        // render state n (0..steps) FROM SCRATCH; must be idempotent
      reset() {},                // back to the initial state; default: setStep(0)
      play(ctx) {},              // entrance animation (non-stepped modules); called on slide entry and by «Repetir»
      destroy() {}               // remove listeners/observers
    };
  }
});
```

- `ctx = { animate: boolean, dir: -1 | 0 | 1, replay?: true }`. `animate` is `true` only when moving
  forward by exactly one step and motion is allowed; going back always renders without animation.
- `setStep(0)` is called right after `render`, and again on every fresh entry to the slide.
- Throwing inside `render` (e.g. invalid config) shows a visible `.viz-error` instead of the module:
  throw early with a Spanish message that tells the author how to fix the config.
- «Repetir» calls `play()` if present; otherwise it re-renders the current step with `animate: true`.

## 4. `api` helpers

| Member | Purpose |
|---|---|
| `api.reduced` | `true` when `prefers-reduced-motion: reduce`. Render the final state, no transitions. |
| `api.el(tag, attrs, children)` | Create an HTML element. `attrs`: `class`, `text`, `style` (object, `--vars` allowed), `onclick`…; `children`: node, string or (nested) arrays. |
| `api.svg(tag, attrs, children)` | Same for SVG. Use `style: {fill: 'var(--s1)'}` for token colors (presentation attributes do not resolve `var()`). |
| `api.esc(text)` | HTML-escape a string (prefer `api.el` / text nodes; never `innerHTML` with config text). |
| `api.color(x, soft?)` | CSS var reference: `'a'`→`var(--a)`, `'e'`→`var(--err)`, `2`→`var(--s2)`, `'s3', true`→`var(--s3-soft)`. |
| `api.roleClass(x)` | Text class for a role/series: `'a'`→`pa`, `'r'`→`pr`, `'e'`→`pe`, `3`→`ps3`. |
| `api.segs(spec)` | Rich text: a string, or `[["sum(", ""], ["a", "a"], [")", ""]]` → text nodes and role-colored spans. Use it for every colored inline text in configs. |
| `api.valor(v)` | Cell value node; `null` renders the distinct `NULL` badge (`.v-null`). |
| `api.table(spec)` | Shared data table → `{wrap, table, head[], rows[], cells[][], cols[]}`. `spec`: `{titulo, serie, columnas: ["id" \| {nombre, tipo, clave: "PK"\|"FK", ref, serie}], filas: [[...]]}`. Numeric columns are right-aligned. `wrap` is a `.viz-scroll` container. |
| `api.code(spec)` | Labeled code block on the dark code surface → `div.viz-code`. `spec`: `{lang, titulo, codigo}`; `codigo` is a string or segs. Roles map to code token classes so they stay legible (`a b c d r e` → `fa fb fc fd fr fe`, `k` keyword, `s` string, `com` comment, `fn` function, `hl` highlighted, `1`–`6` series). |
| `api.svgBox(w, h, opts)` | Scrollable SVG canvas → `{wrap, svg, size(w, h)}`. The SVG never shrinks below `opts.minScale` (default .75) of its viewBox width, so labels stay legible on a phone (the `.viz-scroll` wrap scrolls instead), and never grows past `opts.maxScale` (default 1.25). `opts.label` makes it `role="img"`; `opts.clase` adds classes. Call `size()` when the layout changes. |
| `api.marker(svg, color, opts)` | Arrowhead marker in that SVG's `<defs>`, cached per color; returns `'url(#id)'` for `marker-end`. `color` is a CSS value (`'var(--hl)'`); `opts.size` in px (default 8). Clearing the SVG (`textContent = ''`) also removes the markers: reset `svg._markers = null` before reusing. |
| `api.animate(node, keyframes, opts, ctx)` | WAAPI wrapper; duration 0 when motion is reduced or `ctx.animate === false`. Default `fill: 'backwards'` so the CSS state wins afterwards. |
| `api.reflow(node)` | Force layout (to transition from a painted previous state to the new one). |
| `api.caption(text)` | Set the one-line step caption (plain text). |
| `api.stepsChanged()` | Call after the step count changes (e.g. a selector). The engine re-sequences the slide and puts this viz back at step 0. |
| `api.id(prefix)` | Unique id for SVG `clipPath`/`marker` references. |
| `api.root`, `api.body` | The `.viz` element and the `.viz-body` element. |

Shared table states (core CSS): `tr.hl` (current row), `tr.dim`, `tr.strike` (animated
strike-through), `td.hl-col`/`th.hl-col`, `td.hl-cell`.

## 5. Step semantics

- A slide's «Siguiente» sequence is every `.frag` and every `.viz` with `steps > 0`, **in DOM order**.
  A frag is one unit; a viz contributes `steps` units (its states 1..steps). State 0 is shown before
  its first unit.
- «Siguiente» advances one unit (animated); «Anterior» goes back one unit (not animated) and, at
  position 0, goes to the previous slide with everything shown. Entering a slide forward or by a
  dot resets every viz (`reset`) and plays non-stepped ones (`play`).
- Outside a deck, a `[data-stepper]` container gets its own Anterior / Siguiente / Repetir bar (the
  gallery uses this); a stepped viz's own «Repetir» is hidden there.
- Interactive controls (buttons, selects, inputs) inside a viz never move the slide: keyboard
  navigation ignores events coming from them, and swipes starting on them or on `.viz-scroll` are ignored.
- Deep links for checks: `?slide=N` (1-based), `?pasos=todos` (all steps shown), `?paso=K` (the first K steps
  shown), `?theme=dark|light`. The engine writes each slide's step count to its `data-pasos` attribute.

## 6. `meta.json`

```json
{
  "name": "join",
  "titulo": "JOIN entre dos tablas",
  "forma": ["SQL", "combinación"],
  "cuando": "Cuándo elegir este módulo (una o dos frases).",
  "cuandoNo": "Cuándo no, y qué módulo usar en su lugar.",
  "config": { "every option with an example value": "..." }
}
```

`forma` tags describe the shape of the idea (transformación, iteración, datos tabulares, pipeline…)
so the agent can pick modules by the shape of what it teaches. `config` documents **every** option.

## 7. Design rules (from `references/diseno.md`)

- Colors only through tokens, never raw hex: role colors `--a --b --c --d --r --err` (+ `-soft`),
  categorical series `--s1`…`--s6` (+ `-soft`) for tables/layers/entities, `--hl`/`--hl-soft` for
  «attention on this step», `--ink --muted --line --surface --bg`. Green only for results/valid,
  red only for invalid. All tokens exist in the 3 token blocks (light, dark by preference, `[data-theme=dark]`).
- Fit 360 px width: SVG with `viewBox`; anything wider goes in `.viz-scroll` (own horizontal scroll),
  never the body.
- Reduced motion: final state immediately (core CSS disables transitions; for WAAPI use `api.animate`;
  for CSS keyframes add a `prefers-reduced-motion` override showing the end state).
- Quiet UI: no shadows on cards, no uppercase labels, Bricolage Grotesque + JetBrains Mono only.
- Visible text in neutral Spanish with « » and ’; straight quotes only in code. Code comments in English.
- Data shown as engine output (SQL, pandas…) must come from a real execution, kept as provenance.
- Prefix every class with a short module prefix (`jn-`, `osql-`, `maq-`, `tr-`, `cp-`, `sq-`, `lt-`, `ar-`, `gf-`, `ad-`, `gr-`,
  `cu-`, `es-`, `me-`). State classes (`now`, `on`, `dim`…) are fine only combined with a prefixed class: a bare
  global name such as `.top`, `.nav`, `.slide` or `.result` is already styled by the deck.
- SVG text: at least 12 px in viewBox units and `api.svgBox` with `minScale` ≥ .85, so it never renders below ~10 px.
  Mono text in SVG and module markup needs `font-variant-ligatures:none` (core sets it for `.viz svg text`).
- Wrap module code in an IIFE when it needs helper functions outside `render`: the bundle shares one global scope.

## 8. Checklist for a new module

1. `node --check assets/viz/<name>/viz.js`
2. Add the module to a group in `GROUPS` (`scripts/build_biblioteca.py`; otherwise it appears under «Otros»), then
   `python3 scripts/build_biblioteca.py`
3. `python3 scripts/validate.py assets/biblioteca.html --screenshots <dir>` and look at the PNGs
   (mobile and desktop, light and dark). Captures force reduced motion, so they show final states.
4. Build a deck that uses it: `python3 scripts/build.py deck.html -o out.html` and validate with `--pasos`
   (every intermediate step; `--slide N` limits it to one slide).
