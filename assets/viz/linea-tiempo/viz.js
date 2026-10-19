/* viz: linea-tiempo — two modes sharing lanes:
   - "eventos" (default): lanes over a time axis; events (points or spans) appear per step and a
     playhead moves to the step's time. Events with the same "paso" appear together.
   - "cola": lanes are containers (pila = call stack, cola = FIFO queue, salida = console output);
     each step is a snapshot of their contents (omitted lanes keep their previous content) and
     "imprime" appends to the output. Optional program with the current line highlighted. */
(function () {
Viz.register('linea-tiempo', {
  render: function (el, cfg, api) {
    var carriles = cfg.carriles || [];
    if (!carriles.length) throw new Error('«linea-tiempo» necesita "carriles": [{ "id": "render", "nombre": "Render" }, …].');
    return cfg.modo === 'cola' ? colaMode(el, cfg, api, carriles) : eventosMode(el, cfg, api, carriles);
  }
});

function eventosMode(el, cfg, api, carriles) {
  var s = api.svg;
  var lane = {};
  carriles.forEach(function (c, i) { lane[c.id] = i; });
  var evs = (cfg.eventos || []).map(function (e, i) {
    if (!(e.carril in lane)) throw new Error('El evento ' + (i + 1) + ' usa un carril que no existe: «' + e.carril + '».');
    if (typeof e.t !== 'number') throw new Error('El evento ' + (i + 1) + ' necesita "t" numérico.');
    return { carril: e.carril, t: e.t, fin: typeof e.fin === 'number' ? e.fin : null, etiqueta: String(e.etiqueta || ''), nota: e.nota, paso: e.paso, i: i };
  });
  /* group events into steps: same "paso" value -> same step; otherwise one step each */
  var groups = [], byKey = {};
  evs.forEach(function (e) {
    if (e.paso != null) {
      if (!(e.paso in byKey)) { byKey[e.paso] = groups.length; groups.push([]); }
      groups[byKey[e.paso]].push(e); e.g = byKey[e.paso];
    } else { e.g = groups.length; groups.push([e]); }
  });
  var eje = cfg.eje || {};
  var tmin = typeof eje.inicio === 'number' ? eje.inicio : Math.min.apply(null, evs.map(function (e) { return e.t; }).concat([0]));
  var tmax = typeof eje.fin === 'number' ? eje.fin : Math.max.apply(null, evs.map(function (e) { return e.fin != null ? e.fin : e.t; }).concat([tmin + 1]));
  /* thin no-break space between the number and its unit: «0 ms», «3 viajes» */
  var unidad = eje.unidad ? '\u202F' + String(eje.unidad).trim() : '';

  var labW = Math.max.apply(null, carriles.map(function (c) { return String(c.nombre || c.id).length * 8 + 22; }));
  labW = Math.max(70, Math.min(labW, 170));
  var W = Math.max(480, cfg.ancho || 640), LH = 52, TOP = 26, H = TOP + carriles.length * LH + 34;
  var x0 = labW + 10, x1 = W - 24;
  function X(t) { return x0 + (t - tmin) / ((tmax - tmin) || 1) * (x1 - x0); }

  /* label placement, computed once so labels never jump between steps: beside the mark,
     else above, else below; collisions are checked per lane */
  var place = {};
  (function () {
    var occ = {};
    function rows(l) { return occ[l] = occ[l] || { mid: [], top: [], bot: [] }; }
    function free(list, a, b) { return a >= 2 && b <= W - 2 && list.every(function (r) { return b + 3 <= r[0] || a - 3 >= r[1]; }); }
    evs.forEach(function (e) {
      var R = rows(e.carril), x = X(e.t);
      R.mid.push(e.fin != null ? [x, Math.max(X(e.fin), x + 6)] : [x - 8, x + 8]);
    });
    evs.forEach(function (e) {
      var R = rows(e.carril), lw = e.etiqueta.length * 7.9, x = X(e.t), c = [];
      if (e.fin != null) {
        var xb = Math.max(X(e.fin), x + 6);
        if (lw + 12 <= xb - x) { place[e.i] = { x: (x + xb) / 2, dy: 4.5, anchor: 'middle' }; return; }
        c.push({ row: 'mid', a: xb + 6, b: xb + 6 + lw, p: { x: xb + 6, dy: 4.5, anchor: 'start' } });
        x = (x + xb) / 2;
      } else {
        c.push({ row: 'mid', a: x + 11, b: x + 11 + lw, p: { x: x + 11, dy: 4.5, anchor: 'start' } });
      }
      c.push({ row: 'top', a: x - lw / 2, b: x + lw / 2, p: { x: x, dy: -14, anchor: 'middle' } });
      c.push({ row: 'bot', a: x - lw / 2, b: x + lw / 2, p: { x: x, dy: 23, anchor: 'middle' } });
      if (e.fin == null) c.push({ row: 'mid', a: x - 11 - lw, b: x - 11, p: { x: x - 11, dy: 4.5, anchor: 'end' } });
      var pick = c.find(function (k) { return free(R[k.row], k.a, k.b); }) || c[0];
      R[pick.row].push([pick.a - 6, pick.b + 6]);
      place[e.i] = pick.p;
    });
  })();

  var ticks = [];
  if (Array.isArray(eje.marcas)) ticks = eje.marcas.map(function (m) { return typeof m === 'number' ? { t: m, texto: m + unidad } : { t: m.t, texto: String(m.texto) }; });
  else {
    var span = tmax - tmin, raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var step = [1, 2, 5, 10].map(function (k) { return k * p; }).find(function (k) { return k >= raw; }) || p * 10;
    for (var v = Math.ceil(tmin / step) * step; v <= tmax + 1e-9; v += step) ticks.push({ t: +v.toFixed(6), texto: +v.toFixed(6) + unidad });
  }

  var box = api.svgBox(W, H, { minScale: 0.85, maxScale: 1, label: api.root.getAttribute('aria-label') || 'Línea de tiempo', clase: 'lt' });
  el.appendChild(box.wrap);
  var svg = box.svg;

  function draw(cur, ctx) {
    svg.textContent = '';
    carriles.forEach(function (c, i) {
      var y = TOP + i * LH;
      svg.appendChild(s('rect', { x: 0, y: y + 2, width: W, height: LH - 4, rx: 8, class: 'lt-band' + (i % 2 ? ' odd' : '') }));
      svg.appendChild(s('rect', { x: 6, y: y + LH / 2 - 7, width: 4, height: 14, rx: 2, style: { fill: c.serie ? api.color(c.serie) : 'var(--muted)' } }));
      svg.appendChild(s('text', { x: 16, y: y + LH / 2 + 4.5, class: 'lt-lane' }, String(c.nombre || c.id)));
    });
    var axisY = TOP + carriles.length * LH + 4;
    svg.appendChild(s('line', { x1: x0, y1: axisY, x2: x1, y2: axisY, class: 'lt-axis' }));
    ticks.forEach(function (tk) {
      var x = X(tk.t);
      svg.appendChild(s('line', { x1: x, y1: TOP, x2: x, y2: axisY + 4, class: 'lt-grid' }));
      svg.appendChild(s('text', { x: x, y: axisY + 18, 'text-anchor': 'middle', class: 'lt-tick' }, tk.texto));
    });
    var playLayer = s('g');
    svg.appendChild(playLayer);
    var nowNodes = [], tNow = null;
    evs.forEach(function (e) {
      if (e.g >= cur) return;
      var now = e.g === cur - 1;
      var c = carriles[lane[e.carril]], col = c.serie ? api.color(c.serie) : 'var(--ink)';
      var y = TOP + lane[e.carril] * LH + LH / 2;
      var g = s('g', { class: 'lt-ev' + (now ? ' now' : '') });
      var L = place[e.i];
      if (e.fin != null) {
        var xa = X(e.t), xb = Math.max(X(e.fin), xa + 6);
        g.appendChild(s('rect', { x: xa, y: y - 12, width: xb - xa, height: 24, rx: 6, class: 'lt-span',
          style: now ? null : { fill: c.serie ? api.color(c.serie, true) : 'var(--surface)', stroke: col } }));
      } else {
        g.appendChild(s('circle', { cx: X(e.t), cy: y, r: 6.5, class: 'lt-pt', style: now ? null : { fill: col } }));
      }
      g.appendChild(s('text', { x: L.x, y: y + L.dy, 'text-anchor': L.anchor, class: 'lt-lbl' }, e.etiqueta));
      svg.appendChild(g);
      if (now) { nowNodes.push(g); tNow = Math.max(tNow == null ? -Infinity : tNow, e.t); }
    });
    if (tNow != null) {
      var px = X(tNow);
      var ph = s('g', { class: 'lt-play' }, [
        s('line', { x1: px, y1: TOP - 4, x2: px, y2: axisY, class: 'lt-head' }),
        s('path', { d: 'M' + (px - 5) + ' ' + (TOP - 12) + ' h10 l-5 7 z', class: 'lt-head-tip' })
      ]);
      playLayer.appendChild(ph);
      if (ctx && ctx.animate && cur > 1) {
        var prev = Math.max.apply(null, groups[cur - 2].map(function (e) { return e.t; }));
        var dx = X(prev) - px;
        api.animate(ph, [{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: 450 }, ctx);
      }
    }
    if (ctx && ctx.animate) nowNodes.forEach(function (g) {
      api.animate(g, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 200 }, ctx);
    });
  }

  function setStep(n, ctx) {
    n = Math.max(0, Math.min(n, groups.length));
    draw(n, ctx);
    if (n === 0) { api.caption(cfg.intro || 'Avanza para ver qué ocurre y cuándo.'); return; }
    api.caption(groups[n - 1].map(function (e) { return e.nota || e.etiqueta; }).join(' '));
  }
  return { steps: groups.length, setStep: setStep };
}

function colaMode(el, cfg, api, carriles) {
  var h = api.el;
  var pasos = cfg.pasos || [];
  var lines = cfg.codigo ? String(cfg.codigo.codigo || cfg.codigo).split('\n') : [];
  var lineEls = lines.map(function (l, i) {
    return h('span', { class: 'lt-ln' }, [h('span', { class: 'lt-ln-n', 'aria-hidden': 'true' }, String(i + 1)), l || ' ']);
  });
  var code = lines.length ? h('div', { class: 'viz-code lt-code' }, [
    h('div', { class: 'viz-code-head' }, [h('span', { class: 'viz-code-title' }, (cfg.codigo && cfg.codigo.titulo) || 'Programa'),
      h('span', { class: 'viz-code-lang' }, (cfg.codigo && cfg.codigo.lang) || 'js')]),
    h('pre', { class: 'code' }, h('code', null, lineEls))
  ]) : null;
  var boxes = carriles.map(function (c) {
    var tipo = ['pila', 'cola', 'salida'].indexOf(c.tipo) >= 0 ? c.tipo : 'cola';
    var list = h('ol', { class: 'lt-items' });
    var hint = tipo === 'pila' ? 'entra y sale por arriba' : (tipo === 'cola' ? 'sale el primero que entró' : '');
    var node = h('section', { class: 'lt-box ' + tipo, style: { '--col': c.serie ? api.color(c.serie) : 'var(--muted)' } }, [
      h('h4', { class: 'lt-box-t' }, [h('span', { class: 'lt-sw', 'aria-hidden': 'true' }), String(c.nombre || c.id)]),
      hint ? h('p', { class: 'lt-hint' }, hint) : null,
      list
    ]);
    return { id: c.id, tipo: tipo, node: node, list: list };
  });
  el.appendChild(h('div', { class: 'lt-q' }, [code, h('div', { class: 'lt-boxes' }, boxes.map(function (b) { return b.node; }))]));

  function state(n) {
    var cont = {}, out = [], prevCont = {};
    boxes.forEach(function (b) { cont[b.id] = ((cfg.inicial || {})[b.id] || []).slice(); });
    for (var i = 0; i < n; i++) {
      var p = pasos[i];
      prevCont = JSON.parse(JSON.stringify(cont));
      Object.keys(p.contenido || {}).forEach(function (k) { if (k in cont) cont[k] = (p.contenido[k] || []).slice(); });
      if (p.imprime != null) out = out.concat(Array.isArray(p.imprime) ? p.imprime.map(String) : [String(p.imprime)]);
    }
    return { cont: cont, prev: n > 0 ? prevCont : cont, out: out, outPrev: n > 0 && pasos[n - 1].imprime != null ? out.length - [].concat(pasos[n - 1].imprime).length : out.length };
  }

  function setStep(n, ctx) {
    n = Math.max(0, Math.min(n, pasos.length));
    var st = state(n), p = n > 0 ? pasos[n - 1] : null;
    boxes.forEach(function (b) {
      b.list.textContent = '';
      var items = b.tipo === 'salida' ? st.out : st.cont[b.id];
      var before = b.tipo === 'salida' ? st.out.slice(0, st.outPrev) : (st.prev[b.id] || []);
      var fresh = [];
      items.forEach(function (it, i) {
        var isNew = b.tipo === 'salida' ? i >= st.outPrev : before.indexOf(it) < 0;
        var li = h('li', { class: 'lt-item' + (isNew && n > 0 ? ' new' : '') }, String(it));
        b.list.appendChild(li);
        if (isNew && n > 0) fresh.push(li);
      });
      if (!items.length) b.list.appendChild(h('li', { class: 'lt-empty' }, b.tipo === 'salida' ? 'sin salida aún' : 'vacía'));
      b.node.classList.toggle('now', !!p && (p.activo === b.id || fresh.length > 0));
      if (ctx && ctx.animate) fresh.forEach(function (li) {
        api.animate(li, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 150 }, ctx);
      });
    });
    lineEls.forEach(function (l, i) { l.classList.toggle('now', !!p && p.linea === i + 1); });
    api.caption(n === 0 ? (cfg.intro || 'Avanza para ejecutar el programa paso a paso.') : (p.texto || ''));
  }
  return { steps: pasos.length, setStep: setStep };
}
})();
