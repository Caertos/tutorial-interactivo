/* viz: cuadricula — array (1D) or matrix (2D) cells with indices and named pointers. Steps set
   pointers, a window, comparisons and swaps (animated), fix cells (final position / found) and
   discard cells (search space shrinks). State is folded from step 1 to n, so setStep is idempotent. */
Viz.register('cuadricula', {
  render: function (el, cfg, api) {
    var h = api.el;
    var is2D = Array.isArray(cfg.matriz);
    var init = is2D ? cfg.matriz.map(function (r) { return r.slice(); }) : (cfg.valores || []).slice();
    if (!init.length) throw new Error('«cuadricula» necesita "valores": [ … ] o "matriz": [[ … ], …].');
    var R = is2D ? init.length : 1, C = is2D ? Math.max.apply(null, init.map(function (r) { return r.length; })) : init.length;
    var pasos = cfg.pasos || [];
    var showIdx = cfg.indices !== false;
    function key(p) { return is2D ? (Array.isArray(p) ? p[0] + ',' + p[1] : String(p)) : String(p); }
    function rc(k) { var a = k.split(','); return is2D ? [+a[0], +a[1]] : [0, +a[0]]; }

    /* pointer colors: config, else order of first appearance */
    var pcol = Object.assign({}, cfg.colores || {}), nextC = 1;
    pasos.forEach(function (p) { Object.keys(p.punteros || {}).forEach(function (k) { if (!(k in pcol)) pcol[k] = nextC++; }); });

    var cells = {}, ptrBoxes = {};
    var grid = h('div', { class: 'cu-grid' + (is2D ? ' d2' : ''), style: { '--cols': C } });
    if (is2D && showIdx) {
      grid.appendChild(h('span', { class: 'cu-corner' }));
      for (var c = 0; c < C; c++) grid.appendChild(h('span', { class: 'cu-ix col' }, String(c)));
    }
    for (var r = 0; r < R; r++) {
      if (is2D && showIdx) grid.appendChild(h('span', { class: 'cu-ix row' }, String(r)));
      for (c = 0; c < C; c++) {
        var k = is2D ? r + ',' + c : String(c);
        var v = h('span', { class: 'cu-v' });
        var ptr = h('span', { class: 'cu-ptrs' });
        var cell = h('div', { class: 'cu-cell' }, [
          !is2D && showIdx ? h('span', { class: 'cu-ix' }, String(c)) : null,
          h('span', { class: 'cu-box' }, [v, is2D ? ptr : null]),
          !is2D ? ptr : null
        ]);
        cells[k] = { el: cell, v: v };
        ptrBoxes[k] = ptr;
        grid.appendChild(cell);
      }
    }
    var legend = h('p', { class: 'cu-legend', 'aria-hidden': 'true' });
    el.appendChild(h('div', { class: 'cu' }, [cfg.titulo ? h('p', { class: 'cu-title' }, cfg.titulo) : null, h('div', { class: 'viz-scroll' }, grid), legend]));

    function get(vals, k) { var p = rc(k); return is2D ? (vals[p[0]] || [])[p[1]] : vals[p[1]]; }
    function put(vals, k, x) { var p = rc(k); if (is2D) vals[p[0]][p[1]] = x; else vals[p[1]] = x; }
    function range(win) {
      var out = {};
      if (!win) return out;
      if (is2D) {
        var a = win[0], b = win[1];
        for (var i = Math.min(a[0], b[0]); i <= Math.max(a[0], b[0]); i++) for (var j = Math.min(a[1], b[1]); j <= Math.max(a[1], b[1]); j++) out[i + ',' + j] = 1;
      } else for (var x = Math.min(win[0], win[1]); x <= Math.max(win[0], win[1]); x++) out[String(x)] = 1;
      return out;
    }

    function state(n) {
      var st = { vals: JSON.parse(JSON.stringify(init)), fix: {}, out: {}, ptr: {}, win: null, cmp: {}, swap: null };
      for (var i = 0; i < n; i++) {
        var p = pasos[i];
        if (p.valores) st.vals = JSON.parse(JSON.stringify(p.valores));
        if (p.restaurar) st.out = {};
        if (p.intercambiar) {
          var a = key(p.intercambiar[0]), b = key(p.intercambiar[1]), t = get(st.vals, a);
          put(st.vals, a, get(st.vals, b)); put(st.vals, b, t);
        }
        (p.fijar || []).forEach(function (x) { st.fix[key(x)] = 1; });
        (p.descartar || []).forEach(function (x) { st.out[key(x)] = 1; });
        if (p.punteros) st.ptr = p.punteros;
        if ('ventana' in p) st.win = p.ventana;
      }
      if (n > 0) {
        (pasos[n - 1].comparar || []).forEach(function (x) { st.cmp[key(x)] = 1; });
        if (pasos[n - 1].intercambiar) st.swap = pasos[n - 1].intercambiar.map(key);
      }
      return st;
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      var st = state(n), win = range(st.win);
      Object.keys(cells).forEach(function (k) {
        var cl = cells[k], val = get(st.vals, k);
        cl.v.textContent = val == null ? '' : String(val);
        var e = cl.el, p = rc(k);
        e.classList.toggle('cmp', !!st.cmp[k]);
        e.classList.toggle('swap', !!st.swap && st.swap.indexOf(k) >= 0);
        e.classList.toggle('fix', !!st.fix[k]);
        e.classList.toggle('out', !!st.out[k] && !st.fix[k]);
        e.classList.toggle('win', !!win[k]);
        e.classList.toggle('win-s', !!win[k] && !win[is2D ? p[0] + ',' + (p[1] - 1) : String(p[1] - 1)]);
        e.classList.toggle('win-e', !!win[k] && !win[is2D ? p[0] + ',' + (p[1] + 1) : String(p[1] + 1)]);
        if (is2D) {
          e.classList.toggle('win-t', !!win[k] && !win[(p[0] - 1) + ',' + p[1]]);
          e.classList.toggle('win-b', !!win[k] && !win[(p[0] + 1) + ',' + p[1]]);
        }
        ptrBoxes[k].textContent = '';
      });
      Object.keys(st.ptr).forEach(function (name) {
        var at = st.ptr[name];
        if (at == null) return;
        var k = key(at);
        if (!ptrBoxes[k]) return;
        var col = pcol[name] === 'hl' ? 'var(--hl)' : api.color(pcol[name]);
        ptrBoxes[k].appendChild(h('span', { class: 'cu-ptr', style: { '--col': col } }, [is2D ? null : h('span', { class: 'cu-caret', 'aria-hidden': 'true' }, '▲'), name]));
      });
      if (st.swap && ctx && ctx.animate) {
        var a = cells[st.swap[0]], b = cells[st.swap[1]];
        var ra = a.el.getBoundingClientRect(), rb = b.el.getBoundingClientRect();
        api.animate(a.v, [{ transform: 'translate(' + (rb.left - ra.left) + 'px,' + (rb.top - ra.top) + 'px)' }, { transform: 'none' }], { duration: 520 }, ctx);
        api.animate(b.v, [{ transform: 'translate(' + (ra.left - rb.left) + 'px,' + (ra.top - rb.top) + 'px)' }, { transform: 'none' }], { duration: 520 }, ctx);
      }
      var parts = [];
      if (Object.keys(st.cmp).length) parts.push(['cmp', 'comparando']);
      if (Object.keys(st.fix).length) parts.push(['fix', cfg.textoFijo || 'en su sitio']);
      if (Object.keys(st.out).length) parts.push(['out', 'descartado']);
      if (st.win) parts.push(['win', 'ventana']);
      legend.textContent = '';
      parts.forEach(function (p) { legend.appendChild(h('span', { class: 'cu-key ' + p[0] }, p[1])); });
      api.caption(n === 0 ? (cfg.intro || 'Avanza para ver cada paso.') : (pasos[n - 1].texto || ''));
    }
    return { steps: pasos.length, setStep: setStep };
  }
});
