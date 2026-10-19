/* viz: secuencia — sequence diagram. Actors are columns with lifelines; each message (or note)
   is one step. sync = solid arrow, async = dashed arrow, retorno = dashed muted arrow.
   Activation bars are derived: a sync/async message opens one on the receiver, a retorno closes
   the sender's innermost one; an actor that sends while idle gets one too. */
Viz.register('secuencia', {
  render: function (el, cfg, api) {
    var s = api.svg;
    var actores = cfg.actores || [];
    if (actores.length < 1) throw new Error('«secuencia» necesita "actores": [{ "id": "cli", "nombre": "Cliente" }, …].');
    var col = {};
    actores.forEach(function (a, i) { if (!a.id) throw new Error('Cada actor necesita "id".'); col[a.id] = i; });
    var items = (cfg.mensajes || []).map(function (m, i) {
      if (m.nota != null) {
        var sobre = (Array.isArray(m.sobre) ? m.sobre : [m.sobre || actores[0].id]).filter(function (x) { return x in col; });
        return { nota: true, texto: String(m.nota), sobre: sobre.length ? sobre : [actores[0].id], explica: m.explica };
      }
      if (!(m.desde in col) || !(m.hacia in col)) throw new Error('El mensaje ' + (i + 1) + ' usa un actor que no existe: «' + m.desde + '» → «' + m.hacia + '».');
      var tipo = ['sync', 'async', 'retorno'].indexOf(m.tipo) >= 0 ? m.tipo : 'sync';
      return { desde: m.desde, hacia: m.hacia, texto: String(m.texto || ''), tipo: tipo, explica: m.explica, self: m.desde === m.hacia };
    });

    /* ---------- horizontal layout: column gaps fit the longest label they carry ---------- */
    var CH = 7.85, HEAD_CH = 8.4;
    var headW = actores.map(function (a) { return Math.max(70, String(a.nombre || a.id).length * HEAD_CH + 24); });
    var n = actores.length;
    var gaps = [];
    for (var g = 0; g < n - 1; g++) gaps.push(Math.max(110, (headW[g] + headW[g + 1]) / 2 + 16));
    var rightExtra = headW[n - 1] / 2 + 12;
    items.forEach(function (m) {
      if (m.nota) return;
      var w = m.texto.length * CH + 28;
      var a = col[m.desde], b = col[m.hacia];
      if (m.self) {
        if (a < n - 1) gaps[a] = Math.max(gaps[a], w + 30); else rightExtra = Math.max(rightExtra, w + 40);
        return;
      }
      var lo = Math.min(a, b), hi = Math.max(a, b), k = hi - lo;
      for (var j = lo; j < hi; j++) gaps[j] = Math.max(gaps[j], w / k);
    });
    var xs = [Math.max(headW[0] / 2 + 8, 40)];
    gaps.forEach(function (gw) { xs.push(xs[xs.length - 1] + gw); });
    var W = Math.ceil(xs[n - 1] + rightExtra);

    /* ---------- vertical layout ---------- */
    var HEAD_Y = 6, HEAD_H = 32, y = HEAD_Y + HEAD_H + 34;
    var rows = items.map(function (m) {
      var r = { y: y };
      y += m.nota ? 40 : (m.self ? 60 : 44);
      return r;
    });
    var H = y + 6;

    /* ---------- activations (depth per actor per row) ---------- */
    var bars = [];          // {actor, depth, from(row), to(row|null)}
    var open = actores.map(function () { return []; });
    var depthAt = items.map(function () { return {}; });
    items.forEach(function (m, i) {
      if (m.nota) return;
      var a = col[m.desde], b = col[m.hacia];
      if (open[a].length === 0 && m.tipo !== 'retorno') { var bar0 = { actor: a, depth: 0, from: i, to: null }; bars.push(bar0); open[a].push(bar0); }
      depthAt[i].from = Math.max(0, open[a].length - 1);
      if (m.tipo === 'retorno') {
        var top = open[a].pop();
        if (top) top.to = i;
        depthAt[i].to = Math.max(0, open[b].length - 1);
      } else {
        var bar = { actor: b, depth: open[b].length, from: i, to: null };
        bars.push(bar);
        depthAt[i].to = bar.depth;
        /* a self call returns at once unless the config says otherwise: its bar closes on the same row */
        if (m.self) { bar.to = i; bar.self = true; } else open[b].push(bar);
      }
    });

    var box = api.svgBox(W, H, { minScale: 0.85, maxScale: 1.15, label: api.root.getAttribute('aria-label') || 'Diagrama de secuencia', clase: 'sq' });
    el.appendChild(box.wrap);
    var svg = box.svg;

    function laneX(a, depth) { return xs[a] + depth * 6; }

    function draw(cur, ctx) {
      svg.textContent = '';
      svg._markers = null;
      var mk = { ink: api.marker(svg, 'var(--ink)'), muted: api.marker(svg, 'var(--muted)'), hl: api.marker(svg, 'var(--hl)', { size: 10 }) };
      var bottom = H - 4;
      actores.forEach(function (a, i) {
        svg.appendChild(s('line', { x1: xs[i], y1: HEAD_Y + HEAD_H, x2: xs[i], y2: bottom, class: 'sq-life' }));
      });
      var lastY = cur > 0 ? rows[cur - 1].y + (items[cur - 1].self ? 30 : 14) : 0;
      bars.forEach(function (b) {
        if (b.from >= cur) return;
        var y1 = rows[b.from].y - 4;
        var y2 = b.to != null && b.to < cur ? rows[b.to].y + (b.self ? 30 : 4) : lastY;
        if (y2 <= y1) y2 = y1 + 12;
        svg.appendChild(s('rect', { x: laneX(b.actor, b.depth) - 5, y: y1, width: 10, height: y2 - y1, rx: 2, class: 'sq-act' }));
      });
      actores.forEach(function (a, i) {
        var w = headW[i];
        var c = a.serie ? api.color(a.serie) : 'var(--line)';
        svg.appendChild(s('rect', { x: xs[i] - w / 2, y: HEAD_Y, width: w, height: HEAD_H, rx: 8, class: 'sq-head',
          style: { stroke: c, fill: a.serie ? api.color(a.serie, true) : 'var(--surface)' } }));
        svg.appendChild(s('text', { x: xs[i], y: HEAD_Y + HEAD_H / 2 + 4.5, 'text-anchor': 'middle', class: 'sq-name' }, String(a.nombre || a.id)));
      });
      var nowEl = null;
      for (var i = 0; i < cur; i++) {
        var m = items[i], ry = rows[i].y, now = i === cur - 1;
        var g = s('g', { class: 'sq-msg' + (now ? ' now' : '') + (m.tipo ? ' ' + m.tipo : '') });
        if (m.nota) {
          var cs = m.sobre.map(function (id) { return xs[col[id]]; });
          var x1 = Math.min.apply(null, cs) - 46, x2 = Math.max.apply(null, cs) + 46;
          var tw = m.texto.length * 7 + 22;
          if (x2 - x1 < tw) { var mid = (x1 + x2) / 2; x1 = mid - tw / 2; x2 = mid + tw / 2; }
          x1 = Math.max(2, x1); x2 = Math.min(W - 2, x2);
          g.appendChild(s('rect', { x: x1, y: ry - 14, width: x2 - x1, height: 26, rx: 6, class: 'sq-note' }));
          g.appendChild(s('text', { x: (x1 + x2) / 2, y: ry + 3.5, 'text-anchor': 'middle', class: 'sq-note-t' }, m.texto));
        } else {
          var a = col[m.desde], b = col[m.hacia];
          var stroke = now ? mk.hl : (m.tipo === 'retorno' ? mk.muted : mk.ink);
          var line;
          if (m.self) {
            var sx = laneX(a, depthAt[i].from) + 5, ex = laneX(a, depthAt[i].to) + 5;
            line = s('path', { d: 'M' + sx + ' ' + ry + ' H' + (sx + 36) + ' V' + (ry + 22) + ' H' + (ex + 2), class: 'sq-line' });
            g.appendChild(line);
            var lw = m.texto.length * CH + 10;
            if (now) g.appendChild(s('rect', { x: sx + 42, y: ry - 1, width: lw, height: 19, rx: 4, class: 'sq-lbg' }));
            g.appendChild(s('text', { x: sx + 47, y: ry + 12, class: 'sq-lbl' }, m.texto));
          } else {
            var dir = b > a ? 1 : -1;
            var fx = laneX(a, depthAt[i].from) + dir * 5;
            var tx = laneX(b, depthAt[i].to) - dir * 6;
            line = s('line', { x1: fx, y1: ry, x2: tx, y2: ry, class: 'sq-line' });
            g.appendChild(line);
            var mx = (fx + tx) / 2, lw2 = m.texto.length * CH + 10;
            if (now) g.appendChild(s('rect', { x: mx - lw2 / 2, y: ry - 21, width: lw2, height: 19, rx: 4, class: 'sq-lbg' }));
            g.appendChild(s('text', { x: mx, y: ry - 8, 'text-anchor': 'middle', class: 'sq-lbl' }, m.texto));
          }
          line.setAttribute('marker-end', stroke);
          g._line = line;
        }
        svg.appendChild(g);
        if (now) nowEl = g;
      }
      if (nowEl && ctx && ctx.animate) {
        var ln = nowEl._line;
        if (ln && ln.getTotalLength && !nowEl.classList.contains('async') && !nowEl.classList.contains('retorno')) {
          var len = ln.getTotalLength();
          ln.style.strokeDasharray = len + ' ' + len;
          api.animate(ln, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 500 }, ctx);
        }
        api.animate(nowEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }, ctx);
      }
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, items.length));
      draw(n, ctx);
      if (n === 0) { api.caption(cfg.intro || 'Avanza para ver los mensajes uno a uno.'); return; }
      var m = items[n - 1];
      api.caption(m.explica || m.texto);
    }
    return { steps: items.length, setStep: setStep };
  }
});
