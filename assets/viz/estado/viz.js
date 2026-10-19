/* viz: estado — state machine. States are boxes laid out by distance from the initial state;
   transitions are labeled arrows (curved when there is a reverse pair, loops for self events).
   Each step fires an event: a token travels the transition and the current state changes; an
   event with no transition from the current state is shown as ignored. */
Viz.register('estado', {
  render: function (el, cfg, api) {
    var s = api.svg;
    var estados = (cfg.estados || []).map(function (e) { return { id: String(e.id), nombre: String(e.nombre || e.id), tipo: e.tipo || '', detalle: e.detalle }; });
    if (estados.length < 2) throw new Error('«estado» necesita al menos dos "estados": [{ "id": "pending", "nombre": "pending" }, …].');
    var byId = {};
    estados.forEach(function (e) { byId[e.id] = e; e.out = []; });
    var trans = (cfg.transiciones || []).map(function (t, i) {
      if (!byId[t.desde] || !byId[t.hacia]) throw new Error('La transición ' + (i + 1) + ' usa un estado que no existe: «' + t.desde + '» → «' + t.hacia + '».');
      var o = { desde: t.desde, hacia: t.hacia, evento: String(t.evento || ''), i: i };
      byId[t.desde].out.push(o);
      return o;
    });
    var inicial = byId[cfg.inicial] ? cfg.inicial : ((estados.find(function (e) { return e.tipo === 'inicial'; }) || estados[0]).id);
    var vertical = cfg.direccion === 'abajo';

    /* layers: BFS distance from the initial state; unreachable states go last */
    var dist = {}; dist[inicial] = 0;
    var q = [inicial];
    while (q.length) {
      var id = q.shift();
      byId[id].out.forEach(function (t) { if (!(t.hacia in dist)) { dist[t.hacia] = dist[id] + 1; q.push(t.hacia); } });
    }
    var maxD = Math.max.apply(null, Object.keys(dist).map(function (k) { return dist[k]; }));
    estados.forEach(function (e) { if (!(e.id in dist)) dist[e.id] = maxD + 1; });
    var layers = [];
    estados.forEach(function (e) { (layers[dist[e.id]] = layers[dist[e.id]] || []).push(e); });
    layers = layers.filter(Boolean);
    var hasDet = estados.some(function (e) { return e.detalle; });
    var NH = hasDet ? 50 : 40;
    estados.forEach(function (e) { e.w = Math.max(76, Math.max(e.nombre.length * 8.4, String(e.detalle || '').length * 6.8) + 28); });
    var GAPL = vertical ? 74 : 92, GAPN = vertical ? 30 : 46, PAD = 26;
    var W, H;
    if (vertical) {
      var rw = layers.map(function (L) { return L.reduce(function (a, e) { return a + e.w; }, 0) + (L.length - 1) * GAPN; });
      W = Math.max.apply(null, rw) + PAD * 2;
      layers.forEach(function (L, li) {
        var x = (W - rw[li]) / 2;
        L.forEach(function (e) { e.x = x + e.w / 2; e.y = PAD + 18 + li * (NH + GAPL) + NH / 2; x += e.w + GAPN; });
      });
      H = PAD * 2 + 18 + layers.length * NH + (layers.length - 1) * GAPL;
    } else {
      var cw = layers.map(function (L) { return Math.max.apply(null, L.map(function (e) { return e.w; })); });
      var ch = layers.map(function (L) { return L.length * NH + (L.length - 1) * GAPN; });
      H = Math.max.apply(null, ch) + PAD * 2 + 20;
      var x = PAD + 24;
      layers.forEach(function (L, li) {
        var y = (H - ch[li]) / 2;
        L.forEach(function (e) { e.x = x + cw[li] / 2; e.y = y + NH / 2; y += NH + GAPN; });
        x += cw[li] + GAPL;
      });
      W = x - GAPL + PAD;
    }
    var pasos = (cfg.pasos || []).map(function (p) { return { evento: String(p.evento || ''), hacia: p.hacia, texto: p.texto || '' }; });

    /* fold steps: current state + which transition fired at each step (or null = ignored) */
    function run(n) {
      var cur = inicial, fired = [], took = {};
      for (var i = 0; i < n; i++) {
        var p = pasos[i];
        var t = byId[cur].out.find(function (x) { return x.evento === p.evento && (!p.hacia || x.hacia === p.hacia); }) || null;
        fired.push(t);
        if (t) { took[t.i] = 1; cur = t.hacia; }
      }
      return { cur: cur, fired: fired, took: took };
    }

    var box = api.svgBox(W, H, { minScale: 0.85, maxScale: 1.15, label: api.root.getAttribute('aria-label') || 'Máquina de estados', clase: 'es' });
    var note = api.el('p', { class: 'es-note' });
    el.appendChild(box.wrap);
    el.appendChild(note);
    var svg = box.svg;

    function border(e, tx, ty) {
      var dx = tx - e.x, dy = ty - e.y;
      if (!dx && !dy) return [e.x, e.y];
      var sx = (e.w / 2) / Math.abs(dx || 1e-9), sy = (NH / 2) / Math.abs(dy || 1e-9), k = Math.min(sx, sy);
      return [e.x + dx * k, e.y + dy * k];
    }
    function edgeGeom(t) {
      var a = byId[t.desde], b = byId[t.hacia];
      if (a === b) {
        var lx = a.x + a.w / 2 - 14, ty = a.y - NH / 2;
        return { d: 'M' + (lx - 18) + ' ' + ty + ' C' + (lx - 22) + ' ' + (ty - 40) + ' ' + (lx + 26) + ' ' + (ty - 40) + ' ' + (lx + 8) + ' ' + (ty - 1), lx: lx, ly: ty - 36 };
      }
      var rev = trans.some(function (o) { return o.desde === t.hacia && o.hacia === t.desde; });
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
      var off = rev ? 22 : 0;
      var cx = mx + nx / nl * off, cy = my + ny / nl * off;
      var p1 = border(a, cx, cy), p2 = border(b, cx, cy);
      return { d: 'M' + p1[0] + ' ' + p1[1] + ' Q' + cx + ' ' + cy + ' ' + p2[0] + ' ' + p2[1], lx: (p1[0] + 2 * cx + p2[0]) / 4, ly: (p1[1] + 2 * cy + p2[1]) / 4 };
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      var R = run(n), last = n > 0 ? R.fired[n - 1] : undefined;
      svg.textContent = ''; svg._markers = null;
      /* entry arrow to the initial state */
      var ini = byId[inicial];
      var ep = vertical ? [ini.x, ini.y - NH / 2 - 26] : [ini.x - ini.w / 2 - 26, ini.y];
      svg.appendChild(s('circle', { cx: ep[0], cy: ep[1], r: 5, class: 'es-start' }));
      var ee = vertical ? [ini.x, ini.y - NH / 2 - 2] : [ini.x - ini.w / 2 - 2, ini.y];
      svg.appendChild(s('line', { x1: ep[0], y1: ep[1], x2: ee[0], y2: ee[1], class: 'es-edge', 'marker-end': api.marker(svg, 'var(--muted)') }));
      var nowPath = null;
      trans.forEach(function (t) {
        var g = edgeGeom(t), now = last && last === t;
        var path = s('path', { d: g.d, class: 'es-edge' + (R.took[t.i] ? ' took' : '') + (now ? ' now' : ''),
          'marker-end': api.marker(svg, now ? 'var(--hl)' : (R.took[t.i] ? 'var(--ink)' : 'var(--muted)')) });
        svg.appendChild(path);
        if (now) nowPath = path;
        var tw = t.evento.length * 7.4 + 12;
        svg.appendChild(s('rect', { x: g.lx - tw / 2, y: g.ly - 11, width: tw, height: 21, rx: 5, class: 'es-lbg' + (now ? ' now' : '') }));
        svg.appendChild(s('text', { x: g.lx, y: g.ly + 4, 'text-anchor': 'middle', class: 'es-ev' + (now ? ' now' : '') }, t.evento));
      });
      estados.forEach(function (e) {
        var cur = R.cur === e.id;
        var g = s('g', { class: 'es-st' + (cur ? ' now' : '') + (e.tipo ? ' ' + e.tipo : '') + (cur && last === null ? ' ignored' : ''), transform: 'translate(' + (e.x - e.w / 2) + ',' + (e.y - NH / 2) + ')' });
        g.appendChild(s('rect', { width: e.w, height: NH, rx: NH / 2, class: 'es-box' }));
        if (e.tipo === 'final' || e.tipo === 'error') g.appendChild(s('rect', { x: 4, y: 4, width: e.w - 8, height: NH - 8, rx: NH / 2 - 4, class: 'es-ring' }));
        g.appendChild(s('text', { x: e.w / 2, y: e.detalle ? 21 : NH / 2 + 5, 'text-anchor': 'middle', class: 'es-name' }, e.nombre));
        if (e.detalle) g.appendChild(s('text', { x: e.w / 2, y: 38, 'text-anchor': 'middle', class: 'es-det' }, String(e.detalle)));
        svg.appendChild(g);
        if (cur && last === null) {
          if (ctx && ctx.animate) api.animate(g, [{ transform: 'translate(' + (e.x - e.w / 2 - 5) + 'px,' + (e.y - NH / 2) + 'px)' }, { transform: 'translate(' + (e.x - e.w / 2 + 5) + 'px,' + (e.y - NH / 2) + 'px)' }, { transform: 'translate(' + (e.x - e.w / 2) + 'px,' + (e.y - NH / 2) + 'px)' }], { duration: 300, iterations: 2 }, ctx);
        }
      });
      note.textContent = last === null ? '«' + pasos[n - 1].evento + '» ignorado: no hay transición desde ' + byId[R.cur].nombre + '.' : '';
      /* token travelling along the fired transition */
      if (nowPath && ctx && ctx.animate && nowPath.getTotalLength) {
        var L = nowPath.getTotalLength(), frames = [];
        for (var i = 0; i <= 12; i++) { var p = nowPath.getPointAtLength(L * i / 12); frames.push({ transform: 'translate(' + p.x + 'px,' + p.y + 'px)', opacity: i === 12 ? 0 : 1 }); }
        var tok = s('circle', { r: 7, class: 'es-tok' });
        svg.appendChild(tok);
        var an = api.animate(tok, frames, { duration: 620, easing: 'ease-in-out', fill: 'forwards' }, ctx);
        if (an) an.onfinish = function () { tok.remove(); }; else tok.remove();
      }
      if (n === 0) api.caption(cfg.intro || ('Estado inicial: ' + byId[inicial].nombre + '.'));
      else api.caption(pasos[n - 1].texto || (last ? pasos[n - 1].evento + ': ' + byId[last.desde].nombre + ' → ' + byId[last.hacia].nombre + '.' : 'El evento ' + pasos[n - 1].evento + ' no tiene transición desde ' + byId[R.cur].nombre + ': se ignora.'));
    }
    return { steps: pasos.length, setStep: setStep };
  }
});
