/* viz: grafico — pure SVG charts: bars (vertical/horizontal, grouped), lines (multi-series) and
   scatter. Zero baseline for bars, nice ticks, legend for >= 2 series, direct labels where they
   help, per-mark tooltip on hover/focus and a data table. Steps reveal series (snapshot that
   carries over) and highlight categories (only that step). Series keep their slot and color. */
Viz.register('grafico', {
  render: function (el, cfg, api) {
    var h = api.el, s = api.svg;
    var tipo = ['barras', 'lineas', 'dispersion'].indexOf(cfg.tipo) >= 0 ? cfg.tipo : 'barras';
    var horiz = tipo === 'barras' && !!cfg.horizontal;
    var cats = (cfg.categorias || []).map(String);
    var series = (cfg.series || []).map(function (sr, i) {
      return { nombre: String(sr.nombre || ('Serie ' + (i + 1))), serie: sr.serie || i + 1, valores: sr.valores || [], puntos: sr.puntos || [] };
    });
    if (!series.length) throw new Error('«grafico» necesita "series": [{ "nombre": "T1", "valores": [ … ] }].');
    if (tipo !== 'dispersion' && !cats.length) throw new Error('«grafico» de barras o líneas necesita "categorias".');
    var unidad = cfg.unidad || '';
    var dec = typeof cfg.decimales === 'number' ? cfg.decimales : null;
    function fmtN(v) {
      if (v == null) return '—';
      var t = dec != null ? v.toFixed(dec) : String(Math.round(v * 100) / 100);
      return t.replace('.', cfg.separadorDecimal || '.') + unidad;
    }
    var ejeX = cfg.ejeX || {}, ejeY = cfg.ejeY || {};
    var pasos = cfg.pasos || [];

    function nice(lo, hi, n) {
      if (hi === lo) hi = lo + 1;
      var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
      var st = [1, 2, 2.5, 5, 10].map(function (k) { return k * p; }).find(function (k) { return k >= raw; });
      var a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, out = [];
      for (var v = a; v <= b + st / 1e6; v += st) out.push(+v.toFixed(10));
      return out;
    }
    var allV = [];
    series.forEach(function (sr) { sr.valores.forEach(function (v) { if (typeof v === 'number') allV.push(v); }); });
    var vTicks, xTicks = null;
    if (tipo === 'dispersion') {
      var xs = [], ys = [];
      series.forEach(function (sr) { sr.puntos.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      xTicks = nice(ejeX.min != null ? ejeX.min : Math.min.apply(null, xs), ejeX.max != null ? ejeX.max : Math.max.apply(null, xs), 5);
      vTicks = nice(ejeY.min != null ? ejeY.min : Math.min.apply(null, ys), ejeY.max != null ? ejeY.max : Math.max.apply(null, ys), 5);
    } else {
      var lo = Math.min.apply(null, allV.concat(tipo === 'barras' ? [0] : [])), hi = Math.max.apply(null, allV.concat([tipo === 'barras' ? 0 : lo]));
      if (ejeY.min != null && tipo !== 'barras') lo = ejeY.min;
      if (ejeY.max != null) hi = ejeY.max;
      vTicks = nice(lo, hi, 5);
    }
    var vMin = vTicks[0], vMax = vTicks[vTicks.length - 1];

    /* ---------- geometry ---------- */
    var catLabW = horiz ? Math.min(150, Math.max.apply(null, cats.map(function (c) { return c.length * 7.6; })) + 14) : 0;
    var tickLabW = Math.max.apply(null, vTicks.map(function (v) { return fmtN(v).length * 7.2; })) + 12;
    var W, M, H, PW, PH, band;
    /* chart width follows the container (text stays at its real size); cfg.ancho fixes it */
    function layout(avail) {
      W = cfg.ancho || Math.max(320, Math.min(720, Math.round(avail || 600)));
      M = { t: 16, r: tipo === 'lineas' ? 96 : 20, b: 46 + (ejeX.titulo ? 18 : 0), l: (horiz ? catLabW : tickLabW) + (ejeY.titulo && !horiz ? 20 : 6) };
      H = horiz ? M.t + M.b + cats.length * Math.max(34, series.length * 18 + 16) : (cfg.alto || Math.round(Math.max(260, Math.min(340, W * 0.55))));
      PW = W - M.l - M.r; PH = H - M.t - M.b;
      band = (horiz ? PH : PW) / Math.max(1, cats.length);
    }
    layout(600);
    function V(v) { return horiz ? M.l + (v - vMin) / (vMax - vMin) * PW : M.t + PH - (v - vMin) / (vMax - vMin) * PH; }
    function XS(v) { return M.l + (v - xTicks[0]) / (xTicks[xTicks.length - 1] - xTicks[0]) * PW; }
    function catPos(i) { return (horiz ? M.t : M.l) + band * i + band / 2; }

    /* ---------- DOM ---------- */
    var legend = series.length > 1 ? h('ul', { class: 'gr-legend' }, series.map(function (sr) {
      return h('li', { 'data-s': sr.nombre }, [h('span', { class: 'gr-sw', style: { background: api.color(sr.serie) }, 'aria-hidden': 'true' }), sr.nombre]);
    })) : null;
    var box = api.svgBox(W, H, { minScale: 0.9, maxScale: 1, label: api.root.getAttribute('aria-label') || cfg.titulo || 'Gráfico', clase: 'gr' });
    var tip = h('div', { class: 'gr-tip', role: 'status', hidden: true });
    var stage = h('div', { class: 'gr-stage' }, [box.wrap, tip]);
    var tableRows = tipo === 'dispersion'
      ? [].concat.apply([], series.map(function (sr) { return sr.puntos.map(function (p) { return [sr.nombre, p[2] != null ? p[2] : '', p[0], p[1]]; }); }))
      : cats.map(function (c, i) { return [c].concat(series.map(function (sr) { return sr.valores[i] == null ? null : sr.valores[i]; })); });
    var tableCols = tipo === 'dispersion' ? ['serie', 'punto', ejeX.titulo || 'x', ejeY.titulo || 'y'] : [ejeX.titulo || 'categoría'].concat(series.map(function (sr) { return sr.nombre; }));
    var details = h('details', { class: 'gr-data' }, [h('summary', null, 'Ver los datos'), api.table({ columnas: tableCols, filas: tableRows }).wrap]);
    el.appendChild(h('div', { class: 'gr-wrap' }, [cfg.titulo ? h('p', { class: 'gr-title' }, cfg.titulo) : null, legend, stage, details]));
    var svg = box.svg;

    function showTip(ev, text) {
      tip.textContent = text;
      tip.hidden = false;
      var sr = stage.getBoundingClientRect(), t = ev.target.getBoundingClientRect();
      var x = t.left - sr.left + t.width / 2, y = t.top - sr.top;
      tip.style.left = Math.max(4, Math.min(x, sr.width - 4)) + 'px';
      tip.style.top = y + 'px';
    }
    function hideTip() { tip.hidden = true; }
    function hit(node, text) {
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', text);
      node.addEventListener('pointerenter', function (e) { showTip(e, text); });
      node.addEventListener('focus', function (e) { showTip(e, text); });
      node.addEventListener('pointerleave', hideTip);
      node.addEventListener('blur', hideTip);
      return node;
    }
    /* bar with rounded data end and square baseline end */
    function barPath(x, y, w, hgt, dirUp) {
      var r = Math.min(4, Math.abs(w) / 2, Math.abs(hgt));
      if (horiz) {
        var x2 = x + hgt;
        return dirUp ? 'M' + x + ' ' + y + ' H' + (x2 - r) + ' Q' + x2 + ' ' + y + ' ' + x2 + ' ' + (y + r) + ' V' + (y + w - r) + ' Q' + x2 + ' ' + (y + w) + ' ' + (x2 - r) + ' ' + (y + w) + ' H' + x + ' Z'
          : 'M' + x + ' ' + y + ' H' + (x2 + r) + ' Q' + x2 + ' ' + y + ' ' + x2 + ' ' + (y + r) + ' V' + (y + w - r) + ' Q' + x2 + ' ' + (y + w) + ' ' + (x2 + r) + ' ' + (y + w) + ' H' + x + ' Z';
      }
      var y2 = y - hgt;
      return dirUp ? 'M' + x + ' ' + y + ' V' + (y2 + r) + ' Q' + x + ' ' + y2 + ' ' + (x + r) + ' ' + y2 + ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y2 + ' ' + (x + w) + ' ' + (y2 + r) + ' V' + y + ' Z'
        : 'M' + x + ' ' + y + ' V' + (y2 - r) + ' Q' + x + ' ' + y2 + ' ' + (x + r) + ' ' + y2 + ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y2 + ' ' + (x + w) + ' ' + (y2 - r) + ' V' + y + ' Z';
    }

    function visibleAt(n) {
      var vis = cfg.visibles ? cfg.visibles.map(String) : series.map(function (sr) { return sr.nombre; });
      for (var i = 0; i < n; i++) if (pasos[i].series) vis = pasos[i].series.map(String);
      return vis;
    }

    var cur = 0;
    function draw(n, ctx) {
      hideTip();
      layout(box.wrap.clientWidth);
      box.size(W, H);
      svg.textContent = '';
      var vis = visibleAt(n), prevVis = n > 0 ? visibleAt(n - 1) : vis;
      var hl = n > 0 ? (pasos[n - 1].resaltar || []).map(String) : [];
      var anyHl = hl.length > 0;
      /* grid + value axis */
      vTicks.forEach(function (v) {
        var p = V(v), zero = v === 0;
        svg.appendChild(horiz ? s('line', { x1: p, y1: M.t, x2: p, y2: M.t + PH, class: 'gr-grid' + (zero ? ' zero' : '') })
          : s('line', { x1: M.l, y1: p, x2: M.l + PW, y2: p, class: 'gr-grid' + (zero ? ' zero' : '') }));
        svg.appendChild(horiz ? s('text', { x: p, y: M.t + PH + 18, 'text-anchor': 'middle', class: 'gr-tick' }, fmtN(v))
          : s('text', { x: M.l - 8, y: p + 4, 'text-anchor': 'end', class: 'gr-tick' }, fmtN(v)));
      });
      if (tipo === 'dispersion') {
        xTicks.forEach(function (v) {
          svg.appendChild(s('line', { x1: XS(v), y1: M.t, x2: XS(v), y2: M.t + PH, class: 'gr-grid' }));
          svg.appendChild(s('text', { x: XS(v), y: M.t + PH + 18, 'text-anchor': 'middle', class: 'gr-tick' }, String(+v.toFixed(6))));
        });
      } else {
        cats.forEach(function (c, i) {
          var on = hl.indexOf(c) >= 0;
          svg.appendChild(horiz ? s('text', { x: M.l - 8, y: catPos(i) + 4, 'text-anchor': 'end', class: 'gr-cat' + (on ? ' on' : '') }, c)
            : s('text', { x: catPos(i), y: M.t + PH + 18, 'text-anchor': 'middle', class: 'gr-cat' + (on ? ' on' : '') }, c));
        });
      }
      if (ejeY.titulo && !horiz) svg.appendChild(s('text', { x: 12, y: M.t + PH / 2, 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (M.t + PH / 2) + ')', class: 'gr-axt' }, ejeY.titulo));
      if (ejeX.titulo) svg.appendChild(s('text', { x: M.l + PW / 2, y: H - 8, 'text-anchor': 'middle', class: 'gr-axt' }, ejeX.titulo));
      if (horiz && ejeY.titulo) svg.appendChild(s('text', { x: M.l + PW / 2, y: H - 8 - (ejeX.titulo ? 18 : 0), 'text-anchor': 'middle', class: 'gr-axt' }, ejeY.titulo));

      var single = series.length === 1;
      if (tipo === 'barras') {
        var inner = band * 0.72, bw = (inner - (series.length - 1) * 2) / series.length;
        series.forEach(function (sr, si) {
          if (vis.indexOf(sr.nombre) < 0) return;
          var fresh = prevVis.indexOf(sr.nombre) < 0 && n > 0;
          sr.valores.forEach(function (v, i) {
            if (typeof v !== 'number') return;
            var off = catPos(i) - inner / 2 + si * (bw + 2);
            var base = V(Math.max(vMin, Math.min(0, vMax)));
            var len = horiz ? V(v) - base : base - V(v);
            var dimmed = anyHl && hl.indexOf(cats[i]) < 0;
            var path = s('path', { d: barPath(horiz ? base : off, horiz ? off : base, bw, len, v >= 0), class: 'gr-bar' + (dimmed ? ' dim' : ''), style: { fill: api.color(sr.serie) } });
            svg.appendChild(path);
            if (fresh && ctx && ctx.animate) api.animate(path, [{ transform: horiz ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], { duration: 520, delay: i * 50 }, ctx);
            var showVal = cfg.valores || (anyHl && !dimmed);
            if (showVal) {
              svg.appendChild(horiz ? s('text', { x: V(v) + (v >= 0 ? 6 : -6), y: off + bw / 2 + 4, 'text-anchor': v >= 0 ? 'start' : 'end', class: 'gr-val' }, fmtN(v))
                : s('text', { x: off + bw / 2, y: V(v) + (v >= 0 ? -6 : 14), 'text-anchor': 'middle', class: 'gr-val' }, fmtN(v)));
            }
            var hr = horiz ? s('rect', { x: M.l, y: off - 1, width: PW, height: bw + 2, class: 'gr-hit' }) : s('rect', { x: off - 1, y: M.t, width: bw + 2, height: PH, class: 'gr-hit' });
            svg.appendChild(hit(hr, (single ? '' : sr.nombre + ' · ') + cats[i] + ': ' + fmtN(v)));
          });
        });
      } else if (tipo === 'lineas') {
        series.forEach(function (sr) {
          if (vis.indexOf(sr.nombre) < 0) return;
          var pts = sr.valores.map(function (v, i) { return typeof v === 'number' ? [catPos(i), V(v), v, i] : null; });
          var d = '', pen = false;
          pts.forEach(function (p) { if (!p) { pen = false; return; } d += (pen ? ' L' : ' M') + p[0] + ' ' + p[1]; pen = true; });
          var line = s('path', { d: d, class: 'gr-line', style: { stroke: api.color(sr.serie) } });
          svg.appendChild(line);
          if (prevVis.indexOf(sr.nombre) < 0 && n > 0 && ctx && ctx.animate && line.getTotalLength) {
            var L = line.getTotalLength();
            line.style.strokeDasharray = L + ' ' + L;
            api.animate(line, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700 }, ctx);
          }
          pts.forEach(function (p) {
            if (!p) return;
            var on = anyHl && hl.indexOf(cats[p[3]]) >= 0;
            svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: on ? 6 : 4.5, class: 'gr-pt' + (on ? ' on' : ''), style: { fill: api.color(sr.serie) } }));
            if (on) svg.appendChild(s('text', { x: p[0], y: p[1] - 10, 'text-anchor': 'middle', class: 'gr-val' }, fmtN(p[2])));
            svg.appendChild(hit(s('circle', { cx: p[0], cy: p[1], r: 12, class: 'gr-hit' }), sr.nombre + ' · ' + cats[p[3]] + ': ' + fmtN(p[2])));
          });
          var last = pts.filter(Boolean).pop();
          if (last && series.length <= 4) svg.appendChild(s('text', { x: last[0] + 10, y: last[1] + 4, class: 'gr-dl' }, sr.nombre));
        });
      } else {
        series.forEach(function (sr) {
          if (vis.indexOf(sr.nombre) < 0) return;
          sr.puntos.forEach(function (p) {
            var on = anyHl && p[2] != null && hl.indexOf(String(p[2])) >= 0;
            var dimmed = anyHl && !on;
            var c = s('circle', { cx: XS(p[0]), cy: V(p[1]), r: on ? 7 : 5.5, class: 'gr-dot' + (dimmed ? ' dim' : ''), style: { fill: api.color(sr.serie) } });
            svg.appendChild(c);
            if (on) svg.appendChild(s('text', { x: XS(p[0]) + 10, y: V(p[1]) - 8, class: 'gr-val' }, String(p[2])));
            svg.appendChild(hit(s('circle', { cx: XS(p[0]), cy: V(p[1]), r: 12, class: 'gr-hit' }),
              (p[2] != null ? p[2] + ' · ' : '') + (ejeX.titulo || 'x') + ' ' + p[0] + ', ' + (ejeY.titulo || 'y') + ' ' + fmtN(p[1])));
          });
        });
      }
      if (legend) Array.prototype.forEach.call(legend.children, function (li) { li.classList.toggle('off', vis.indexOf(li.dataset.s) < 0); });
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      cur = n;
      draw(n, ctx);
      api.caption(n === 0 ? (cfg.intro || '') : (pasos[n - 1].texto || ''));
    }
    var lastW = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(function () {
      var w = box.wrap.clientWidth;
      if (w && Math.abs(w - lastW) > 4) { lastW = w; draw(cur, null); }
    }) : null;
    if (ro) ro.observe(box.wrap);
    return { steps: pasos.length, setStep: setStep, destroy: function () { if (ro) ro.disconnect(); el.textContent = ''; } };
  }
});
