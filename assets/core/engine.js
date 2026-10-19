/* ==========================================================================
   tutorial-interactivo — core/engine.js
   1. Viz registry + module helpers (window.Viz)
   2. Stepper: frags + viz steps of one container in DOM order
   3. Deck navigation (only when the page has .stage > .slide)
   4. Shared page behavior: theme, typed signature, quiz, standalone steppers
   Contract for modules: assets/viz/README.md
   ========================================================================== */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var reducedMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var params = new URLSearchParams(location.search);
  var registry = new Map();
  var uid = 0;

  /* ---------- DOM helpers (exposed to modules through api) ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setAttrs(n, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach(function (p) {
          if (v[p] == null) return;
          if (p.indexOf('--') === 0) n.style.setProperty(p, v[p]); else n.style[p] = v[p];
        });
      } else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function append(n, children) {
    if (children == null) return n;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { append(n, c); return; }
      n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  function el(tag, attrs, children) { var n = document.createElement(tag); setAttrs(n, attrs); return append(n, children); }
  function svg(tag, attrs, children) { var n = document.createElementNS(SVGNS, tag); setAttrs(n, attrs); return append(n, children); }

  var ROLES = { a: 'a', b: 'b', c: 'c', d: 'd', r: 'r', e: 'err', err: 'err' };
  /* color('a') -> var(--a); color(2) -> var(--s2); color('s3', true) -> var(--s3-soft) */
  function color(x, soft) {
    var name;
    if (typeof x === 'number') name = 's' + (((Math.max(1, x) - 1) % 6) + 1);
    else if (ROLES[x]) name = ROLES[x];
    else if (/^s[1-6]$/.test(x)) name = x;
    else name = 'ink';
    if (soft && name === 'ink') return 'var(--line)';
    return 'var(--' + name + (soft ? '-soft' : '') + ')';
  }
  /* role/series -> text class used across the deck (.pa, .pr, .ps2, ...) */
  function roleClass(x) {
    if (!x) return '';
    if (typeof x === 'number') return 'ps' + (((x - 1) % 6) + 1);
    if (x === 'e' || x === 'err') return 'pe';
    return 'p' + x;
  }
  /* Rich text segments: "text" | [["sum(",""],["a","a"],[")",""]] -> nodes */
  function segs(spec) {
    if (spec == null) return [];
    if (!Array.isArray(spec)) return [document.createTextNode(String(spec))];
    return spec.map(function (s) {
      if (!Array.isArray(s)) return document.createTextNode(String(s));
      var cls = roleClass(s[1]);
      return cls ? el('span', { class: cls }, String(s[0])) : document.createTextNode(String(s[0]));
    });
  }
  /* A table cell value: null -> NULL badge, numbers right-aligned by caller */
  function valor(v) {
    if (v === null || v === undefined) return el('span', { class: 'v-null' }, 'NULL');
    if (typeof v === 'boolean') return document.createTextNode(v ? 'true' : 'false');
    return document.createTextNode(String(v));
  }
  /* Shared data table.
     spec: {titulo, serie, columnas:[ "id" | {nombre,tipo,clave:"PK"|"FK",ref,serie} ], filas:[[...]], clase}
     returns {wrap, table, head:[th], rows:[tr], cells:[[td]], cols} */
  function table(spec) {
    var cols = (spec.columnas || []).map(function (c) { return typeof c === 'string' ? { nombre: c } : c; });
    var t = el('table', { class: 'vt' + (spec.clase ? ' ' + spec.clase : '') });
    if (spec.titulo != null) {
      t.appendChild(el('caption', { style: spec.serie ? { '--col': color(spec.serie) } : null },
        [el('span', { class: 'sw', 'aria-hidden': 'true' }), String(spec.titulo)]));
    }
    var NUM = /^-?\d+(\.\d+)?$/;
    function isNum(v) { return typeof v === 'number' || (typeof v === 'string' && NUM.test(v)); }
    var numCol = cols.map(function (c, j) {
      var vals = (spec.filas || []).map(function (f) { return f[j]; }).filter(function (v) { return v !== null && v !== undefined; });
      return vals.length > 0 && vals.every(isNum);
    });
    var head = cols.map(function (c, j) {
      var serie = c.serie || spec.serie;
      return el('th', { scope: 'col', class: numCol[j] ? 'num' : null, style: serie ? { '--col': color(serie) } : null, title: c.ref ? 'Referencia a ' + c.ref : null }, [
        el('span', { class: 'vt-name' }, c.nombre),
        c.clave ? el('span', { class: 'vt-key ' + String(c.clave).toLowerCase() }, c.clave) : null,
        c.tipo ? el('span', { class: 'vt-type' }, c.tipo + (c.ref ? ' → ' + c.ref : '')) : (c.ref ? el('span', { class: 'vt-type' }, '→ ' + c.ref) : null)
      ]);
    });
    t.appendChild(el('thead', null, el('tr', null, head)));
    var tb = el('tbody');
    var cells = [];
    var rows = (spec.filas || []).map(function (f) {
      var tds = cols.map(function (c, j) {
        var v = f[j];
        return el('td', { class: numCol[j] ? 'num' : null }, valor(v));
      });
      cells.push(tds);
      var tr = el('tr', null, tds);
      tb.appendChild(tr);
      return tr;
    });
    t.appendChild(tb);
    var wrap = el('div', { class: 'viz-scroll' }, t);
    return { wrap: wrap, table: t, head: head, rows: rows, cells: cells, cols: cols };
  }
  /* WAAPI wrapper that respects reduced motion and ctx.animate=false (jumps to the end). */
  function animate(node, keyframes, opts, ctx) {
    if (!node || !node.animate) return null;
    var o = Object.assign({ duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }, opts || {});
    if (reducedMQ.matches || (ctx && ctx.animate === false)) { o.duration = 0; o.delay = 0; o.iterations = 1; }
    return node.animate(keyframes, o);
  }
  function reflow(node) { return node && node.offsetWidth; }

  /* Code block on the dark code surface: {lang, codigo, titulo}. codigo is a string or segs
     ([["SELECT", "k"], [" id", ""], ...]); roles map to code token classes so they stay legible. */
  var CODE_ROLES = { a: 'fa', b: 'fb', r: 'fr', c: 'fc', d: 'fd', e: 'fe', err: 'fe', k: 'k', s: 's', com: 'c', fn: 'fn', hl: 'code-hl',
    1: 'fa', 2: 'fb', 3: 'fr', 4: 'k', 5: 'fd', 6: 'fc', s1: 'fa', s2: 'fb', s3: 'fr', s4: 'k', s5: 'fd', s6: 'fc' };
  function code(spec) {
    spec = spec || {};
    var src = spec.codigo == null ? '' : spec.codigo;
    var parts = Array.isArray(src) ? src.map(function (s) {
      if (!Array.isArray(s)) return document.createTextNode(String(s));
      var cls = CODE_ROLES[s[1]];
      return cls ? el('span', { class: cls }, String(s[0])) : document.createTextNode(String(s[0]));
    }) : [document.createTextNode(String(src))];
    return el('div', { class: 'viz-code' + (spec.clase ? ' ' + spec.clase : '') }, [
      spec.lang || spec.titulo ? el('div', { class: 'viz-code-head' }, [
        spec.titulo ? el('span', { class: 'viz-code-title' }, String(spec.titulo)) : null,
        spec.lang ? el('span', { class: 'viz-code-lang' }, String(spec.lang)) : null
      ]) : null,
      el('pre', { class: 'code' }, el('code', null, parts))
    ]);
  }
  /* Scrollable SVG canvas: never shrinks below minScale (default .75) of its viewBox width, so
     labels stay legible on a phone (the wrap scrolls instead); never grows past maxScale. */
  function svgBox(w, h, opts) {
    opts = opts || {};
    var mn = opts.minScale || 0.75, mx = opts.maxScale || 1.25;
    var s = svg('svg', { class: 'viz-svg' + (opts.clase ? ' ' + opts.clase : ''), role: opts.label ? 'img' : null, 'aria-label': opts.label || null,
      'aria-hidden': opts.label ? null : 'true' });
    var wrap = el('div', { class: 'viz-scroll viz-svgwrap' }, s);
    function size(W, H) {
      s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      s.style.width = '100%';
      s.style.minWidth = Math.round(W * mn) + 'px';
      s.style.maxWidth = Math.round(W * mx) + 'px';
    }
    size(w, h);
    return { wrap: wrap, svg: s, size: size };
  }
  /* Arrowhead marker for an SVG root, one per color (cached). Returns 'url(#id)'. */
  function marker(root, col, opts) {
    root._markers = root._markers || {};
    var key = col + (opts && opts.size || '');
    if (root._markers[key]) return root._markers[key];
    var defs = root.querySelector('defs') || root.insertBefore(svg('defs'), root.firstChild);
    var sz = (opts && opts.size) || 8;
    var id = 'vzm-' + (++uid);
    defs.appendChild(svg('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: sz, markerHeight: sz,
      markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0.8 L10 5 L0 9.2 Z', style: { fill: col } })));
    root._markers[key] = 'url(#' + id + ')';
    return root._markers[key];
  }

  /* ---------- Viz registry ---------- */
  function register(name, mod) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Viz name must be kebab-case: ' + name);
    if (!mod || typeof mod.render !== 'function') throw new Error('Viz "' + name + '" needs render()');
    registry.set(name, mod);
  }

  function mount(root) {
    if (root._viz) return root._viz;
    var name = root.getAttribute('data-viz');
    var js = null;
    for (var i = 0; i < root.children.length; i++) {
      if (root.children[i].matches('script[type="application/json"]')) { js = root.children[i]; break; }
    }
    var cfg = {};
    function fail(msg) {
      root.appendChild(el('p', { class: 'viz-error', role: 'alert' }, msg));
      root._viz = { root: root, failed: true, steps: function () { return 0; }, set: function () {}, enter: function () {}, reset: function () {}, replay: function () {}, step: 0, onSteps: [] };
      return root._viz;
    }
    if (js) {
      try { cfg = JSON.parse(js.textContent); } catch (e) { return fail('Configuración JSON inválida en data-viz="' + name + '": ' + e.message); }
    }
    var mod = registry.get(name);
    if (!mod) return fail('El módulo «' + name + '» no está incluido en este archivo.');

    root.classList.add('viz-' + name);
    var body = el('div', { class: 'viz-body' });
    var cap = el('p', { class: 'viz-cap', 'aria-live': 'polite' });
    var replayBtn = el('button', { type: 'button', class: 'viz-btn', 'data-viz-replay': '' }, 'Repetir');
    var bar = el('div', { class: 'viz-bar' }, [cap, replayBtn]);
    root.appendChild(body);
    root.appendChild(bar);

    var ctl = { root: root, name: name, cfg: cfg, step: 0, inst: null, onSteps: [] };
    var api = {
      root: root,
      body: body,
      get reduced() { return reducedMQ.matches; },
      id: function (p) { return (p || 'viz') + '-' + (++uid); },
      el: el, svg: svg, esc: esc, color: color, roleClass: roleClass, segs: segs, valor: valor, table: table,
      animate: animate, reflow: reflow, code: code, svgBox: svgBox, marker: marker,
      caption: function (text) { cap.textContent = text == null ? '' : String(text); },
      /* call after the module's step count changed (e.g. a selector); the engine re-sequences
         the slide and puts this viz back at step 0 */
      stepsChanged: function () {
        root.classList.toggle('has-steps', ctl.steps() > 0);
        if (ctl.onSteps.length) ctl.onSteps.forEach(function (f) { f(ctl); });
        else ctl.set(0, { animate: false, dir: 0 });
      }
    };
    ctl.steps = function () { var s = ctl.inst && ctl.inst.steps; return Math.max(0, (typeof s === 'function' ? s() : s) | 0); };
    ctl.set = function (n, ctx) {
      n = Math.max(0, Math.min(n, ctl.steps()));
      var c = Object.assign({ animate: false, dir: Math.sign(n - ctl.step) }, ctx || {});
      if (reducedMQ.matches) c.animate = false;
      ctl.step = n;
      if (ctl.inst.setStep) ctl.inst.setStep(n, c);
    };
    ctl.reset = function () {
      if (ctl.inst.reset) { ctl.inst.reset(); ctl.step = 0; } else ctl.set(0, { animate: false, dir: 0 });
    };
    ctl.enter = function () { if (ctl.inst.play) ctl.inst.play({ animate: !reducedMQ.matches }); };
    ctl.replay = function () {
      if (ctl.inst.play) ctl.inst.play({ animate: !reducedMQ.matches, replay: true });
      else if (ctl.steps() > 0 && ctl.inst.setStep) ctl.inst.setStep(ctl.step, { animate: !reducedMQ.matches, dir: 1, replay: true });
    };
    try {
      ctl.inst = mod.render(body, cfg, api) || {};
    } catch (e) {
      body.remove(); bar.remove();
      return fail('Error al dibujar «' + name + '»: ' + e.message);
    }
    root.classList.toggle('has-steps', ctl.steps() > 0);
    replayBtn.addEventListener('click', function () { ctl.replay(); });
    root._viz = ctl;
    if (ctl.inst.setStep) ctl.inst.setStep(0, { animate: false, dir: 0 });
    return ctl;
  }

  function mountAll(scope) {
    return Array.prototype.map.call((scope || document).querySelectorAll('.viz[data-viz]'), mount);
  }

  /* ---------- Stepper: one sequence of frags + viz steps in DOM order ---------- */
  function Stepper(container) {
    var self = { pos: 0, total: 0, units: [] };
    function build() {
      self.units = [];
      container.querySelectorAll('.frag, .viz[data-viz]').forEach(function (n) {
        if (n.classList.contains('frag')) self.units.push({ frag: n, n: 1 });
        else {
          var ctl = mount(n);
          self.units.push({ ctl: ctl, n: ctl.steps() });
          if (!ctl._stepperBound) {
            ctl._stepperBound = true;
            ctl.onSteps.push(function (c) {
              build();
              var before = 0;
              for (var i = 0; i < self.units.length && self.units[i].ctl !== c; i++) before += self.units[i].n;
              self.pos = Math.min(before, self.total);
              c.set(0, { animate: false, dir: 0 });
              apply({ animate: false });
              if (self.onChange) self.onChange();
            });
          }
        }
      });
      self.total = self.units.reduce(function (s, u) { return s + u.n; }, 0);
    }
    function apply(ctx) {
      var rem = self.pos, last = null;
      self.units.forEach(function (u) {
        var c = Math.min(rem, u.n); rem -= c;
        if (u.frag) {
          u.frag.classList.toggle('shown', c > 0);
          if (c > 0) last = u;
        } else if (u.n > 0) {
          if (c > 0) last = u;
          if (u.ctl.step !== c || ctx.force) {
            u.ctl.set(c, { animate: !!ctx.animate && c === u.ctl.step + 1, dir: Math.sign(c - u.ctl.step) });
          }
        }
      });
      container.querySelectorAll('[data-tok]').forEach(function (t) { t.classList.remove('lit'); });
      if (last && last.frag && last.frag.dataset.hl) {
        container.querySelectorAll('[data-tok="' + last.frag.dataset.hl + '"]').forEach(function (t) { t.classList.add('lit'); });
      }
      return last;
    }
    /* unit currently last revealed (for scrolling into view) */
    self.lastNode = function () {
      var rem = self.pos, node = null;
      self.units.forEach(function (u) { var c = Math.min(rem, u.n); rem -= c; if (c > 0) node = u.frag || u.ctl.root; });
      return node;
    };
    self.set = function (p, ctx) { self.pos = Math.max(0, Math.min(p, self.total)); apply(ctx || {}); if (self.onChange) self.onChange(); };
    /* fresh entry: every viz back to its initial state, then position p */
    self.enter = function (p) {
      self.units.forEach(function (u) { if (u.ctl) u.ctl.reset(); });
      self.pos = Math.max(0, Math.min(p, self.total));
      apply({ animate: false, force: true });
      self.units.forEach(function (u) { if (u.ctl) u.ctl.enter(); });
      if (self.onChange) self.onChange();
    };
    self.next = function () { if (self.pos >= self.total) return false; self.set(self.pos + 1, { animate: true }); return true; };
    self.prev = function () { if (self.pos <= 0) return false; self.set(self.pos - 1, { animate: false }); return true; };
    self.rebuild = build;
    build();
    return self;
  }

  /* ---------- Shared page behavior ---------- */
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  function initTheme() {
    var root = document.documentElement;
    var forced = params.get('theme');
    var saved = storeGet('tutorial-theme');
    if (forced === 'dark' || forced === 'light') root.setAttribute('data-theme', forced);
    else if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
    function effective() {
      var t = root.getAttribute('data-theme');
      if (t) return t;
      return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      function label() {
        var dark = effective() === 'dark';
        b.textContent = dark ? 'Tema claro' : 'Tema oscuro';
        b.setAttribute('aria-pressed', dark ? 'true' : 'false');
      }
      label();
      b.addEventListener('click', function () {
        var next = effective() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        storeSet('tutorial-theme', next);
        document.querySelectorAll('[data-theme-toggle]').forEach(function (x) { x.dispatchEvent(new Event('themechange')); });
      });
      b.addEventListener('themechange', label);
    });
  }

  /* Cover signature auto-fit: CSS sizes .sig from its letter count (--n); this shrinks it further
     only if the rendered text still overflows its box (long names, fallback fonts). */
  function fitSignature(sig) {
    sig.style.fontSize = '';
    var box = sig.clientWidth, need = sig.scrollWidth;
    if (!box || need <= box + 1) return;
    var fs = parseFloat(getComputedStyle(sig).fontSize);
    sig.style.fontSize = Math.max(14, Math.floor(fs * box / need * 0.98)) + 'px';
  }
  function fitSignatures() { document.querySelectorAll('.sig').forEach(fitSignature); }

  /* .sig children (text or spans with role classes) become letter-by-letter spans */
  function initSignatures() {
    document.querySelectorAll('.sig').forEach(function (sig) {
      if (sig.dataset.typed) return;
      sig.dataset.typed = '1';
      if (!sig.getAttribute('aria-label')) sig.setAttribute('aria-label', sig.textContent.trim());
      var parts = [];
      sig.childNodes.forEach(function (n) {
        if (n.nodeType === 3) parts.push([n.textContent, '']);
        else if (n.nodeType === 1) parts.push([n.textContent, n.getAttribute('class') || '']);
      });
      sig.textContent = '';
      var i = 0;
      parts.forEach(function (p) {
        Array.prototype.forEach.call(p[0], function (ch) {
          if (ch === '\n') return;
          sig.appendChild(el('span', { class: ('ch ' + p[1]).trim(), style: { '--i': i++ }, 'aria-hidden': 'true' }, ch === ' ' ? ' ' : ch));
        });
      });
      sig.appendChild(el('span', { class: 'caret', 'aria-hidden': 'true' }));
      sig.style.setProperty('--n', i + 1);
    });
    fitSignatures();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSignatures);
    var t = null;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fitSignatures, 120); });
  }

  /* Quiz: each .opt may carry data-correct="true" and data-why */
  function initQuiz() {
    document.querySelectorAll('.quiz').forEach(function (q) {
      var fb = q.querySelector('.feedback');
      q.querySelectorAll('.opt').forEach(function (o) {
        o.addEventListener('click', function () {
          var ok = o.dataset.correct === 'true';
          o.classList.remove('wrong'); reflow(o);
          o.classList.add(ok ? 'right' : 'wrong');
          if (fb) fb.textContent = (ok ? 'Correcto. ' : 'No exactamente. ') + (o.dataset.why || '');
        });
      });
    });
  }

  function restartAnimations(scope) {
    scope.querySelectorAll('.chip,.sig .ch').forEach(function (n) { n.style.animation = 'none'; reflow(n); n.style.animation = ''; });
  }

  /* [data-stepper] outside a deck: gets Anterior / Siguiente / Repetir controls */
  function initStandaloneSteppers() {
    document.querySelectorAll('[data-stepper]').forEach(function (box) {
      if (box.closest('.slide')) return;
      var st = Stepper(box);
      var prevB = el('button', { type: 'button', class: 'viz-btn' }, 'Anterior');
      var nextB = el('button', { type: 'button', class: 'viz-btn' }, 'Siguiente');
      var againB = el('button', { type: 'button', class: 'viz-btn' }, 'Repetir');
      var count = el('span', { class: 'count', 'aria-live': 'polite' });
      var bar = el('div', { class: 'stepper-bar', role: 'group', 'aria-label': 'Paso a paso' }, [prevB, nextB, againB, count]);
      box.appendChild(bar);
      var replayable = !!box.querySelector('.chip,.sig');
      st.onChange = function () {
        /* no steps: keep only «Repetir» when there are entrance animations to replay */
        bar.hidden = st.total === 0 && !replayable;
        prevB.hidden = nextB.hidden = st.total === 0;
        prevB.disabled = st.pos === 0;
        nextB.disabled = st.pos >= st.total;
        count.textContent = st.total ? 'Paso ' + st.pos + ' de ' + st.total : '';
      };
      prevB.addEventListener('click', function () { st.prev(); });
      nextB.addEventListener('click', function () { st.next(); });
      againB.addEventListener('click', function () { restartAnimations(box); st.enter(0); });
      box.classList.add('is-live');
      st.enter(0);
    });
  }

  /* ---------- Deck navigation ---------- */
  function initDeck() {
    var stage = document.getElementById('stage') || document.querySelector('.stage');
    if (!stage) return null;
    var slides = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
    if (!slides.length) return null;
    var $ = function (id) { return document.getElementById(id); };
    var total = slides.length;
    var steppers = slides.map(Stepper);
    /* step count per slide, readable from the DOM (validate.py --pasos uses it) */
    slides.forEach(function (s, i) { s.setAttribute('data-pasos', steppers[i].total); });
    var idx = 0;
    if ($('tot')) $('tot').textContent = total;

    var dots = $('dots');
    if (dots) {
      dots.innerHTML = '';
      slides.forEach(function (s, i) {
        dots.appendChild(el('button', { type: 'button', 'aria-label': 'Ir a ' + (s.getAttribute('aria-label') || ('diapositiva ' + (i + 1))), onclick: function () { go(i); } }));
      });
    }

    /* showAll: true shows every step; a number shows that many steps */
    function go(i, showAll) {
      if (i < 0 || i >= total) return;
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); s.classList.toggle('before', k < i); });
      var s = slides[i];
      restartAnimations(s);
      idx = i;
      steppers[i].enter(typeof showAll === 'number' ? showAll : (showAll ? steppers[i].total : 0));
      s.scrollTop = 0;
      if ($('cur')) $('cur').textContent = i + 1;
      if ($('bar')) $('bar').style.width = ((i + 1) / total * 100) + '%';
      if (dots) Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); });
      if ($('prev')) $('prev').disabled = i === 0;
      if ($('next')) { $('next').textContent = i === total - 1 ? 'Fin' : 'Siguiente'; $('next').disabled = i === total - 1; }
    }
    function next() {
      var st = steppers[idx];
      if (st.next()) {
        var n = st.lastNode();
        if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest', behavior: reducedMQ.matches ? 'auto' : 'smooth' });
        return;
      }
      go(idx + 1);
    }
    function prev() { if (!steppers[idx].prev()) go(idx - 1, true); }

    if ($('next')) $('next').addEventListener('click', next);
    if ($('prev')) $('prev').addEventListener('click', prev);
    document.querySelectorAll('#restart,[data-restart]').forEach(function (b) { b.addEventListener('click', function () { go(0); }); });

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('input,textarea,select,[contenteditable="true"]') || t.closest('.viz button, .viz [tabindex]'))) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (['ArrowRight', 'PageDown', ' '].indexOf(e.key) >= 0) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'PageUp'].indexOf(e.key) >= 0) { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { go(0); } else if (e.key === 'End') { go(total - 1, true); }
    });

    var sx = 0, sy = 0;
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (e.target.closest('input,select,textarea,button,pre,.tablewrap,.viz-scroll')) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev(); }
    }, { passive: true });

    /* ?slide=N (1-based), ?pasos=todos (every step) or ?paso=K (first K steps) for screenshots and deep links */
    var start = Math.max(1, Math.min(total, parseInt(params.get('slide') || '1', 10) || 1)) - 1;
    var paso = parseInt(params.get('paso'), 10);
    go(start, params.get('pasos') === 'todos' ? true : (paso >= 0 ? paso : false));
    document.documentElement.setAttribute('data-deck-ready', '');
    return { go: go, next: next, prev: prev, slides: slides, steppers: steppers };
  }

  function init() {
    initTheme();
    initSignatures();
    initQuiz();
    mountAll(document);
    window.Tutorial.deck = initDeck();
    initStandaloneSteppers();
  }

  window.Viz = { register: register, mount: mount, mountAll: mountAll, registry: registry,
    helpers: { el: el, svg: svg, esc: esc, color: color, segs: segs, valor: valor, table: table, animate: animate, code: code, svgBox: svgBox, marker: marker } };
  window.Tutorial = { Stepper: Stepper, deck: null };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
