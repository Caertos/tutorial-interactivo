/* viz: join — two input tables, lines between matching keys and a result table built
   row by row. A selector recomputes INNER/LEFT/RIGHT/FULL/CROSS in JS from the config rows.
   Rules: NULL keys never match; duplicate keys multiply rows; unmatched rows are NULL-padded. */
Viz.register('join', {
  render: function (el, cfg, api) {
    var h = api.el, s = api.svg;
    var L = norm(cfg.izquierda || {}, 1), R = norm(cfg.derecha || {}, 2);
    var TIPOS = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'];
    var tipos = (cfg.tipos || TIPOS).filter(function (t) { return TIPOS.indexOf(t) >= 0; });
    var tipo = TIPOS.indexOf(cfg.tipo) >= 0 ? cfg.tipo : (tipos[0] || 'INNER');
    var res = [];
    var cur = 0;

    function norm(t, serie) {
      var cols = (t.columnas || []).map(function (c) { return typeof c === 'string' ? { nombre: c } : c; });
      var names = cols.map(function (c) { return c.nombre; });
      var k = Math.max(0, names.indexOf(t.clave));
      var lab = names.indexOf(t.etiqueta);
      if (lab < 0) lab = names.findIndex(function (n, i) { return i !== k; });
      return { nombre: t.nombre || '', serie: t.serie || serie, cols: cols, filas: t.filas || [], k: k, lab: Math.max(0, lab), clave: names[k] };
    }
    function eq(a, b) { return a !== null && a !== undefined && b !== null && b !== undefined && a === b; }
    function show(v) { return v === null || v === undefined ? 'NULL' : String(v); }

    function compute(t) {
      var out = [], usedR = {};
      if (t === 'CROSS') {
        L.filas.forEach(function (_, i) { R.filas.forEach(function (_, j) { out.push({ l: i, r: j, kind: 'cross' }); }); });
        return out;
      }
      L.filas.forEach(function (lf, i) {
        var m = 0;
        R.filas.forEach(function (rf, j) {
          if (eq(lf[L.k], rf[R.k])) { out.push({ l: i, r: j, kind: 'match', occ: ++m }); usedR[j] = (usedR[j] || 0) + 1; }
        });
        if (m === 0 && (t === 'LEFT' || t === 'FULL')) out.push({ l: i, r: null, kind: 'left' });
      });
      if (t === 'RIGHT') out = out.filter(function (x) { return x.kind !== 'left'; });
      if (t === 'RIGHT' || t === 'FULL') {
        R.filas.forEach(function (_, j) { if (!usedR[j]) out.push({ l: null, r: j, kind: 'right' }); });
      }
      return out;
    }

    /* ---------- static layout ---------- */
    var picker = null, btns = {};
    if (tipos.length > 1) {
      picker = h('div', { class: 'jn-pick', role: 'group', 'aria-label': 'Tipo de JOIN' }, tipos.map(function (t) {
        btns[t] = h('button', { type: 'button', class: 'viz-btn', 'aria-pressed': 'false', onclick: function () { choose(t); } }, t);
        return btns[t];
      }));
    }
    var vennBox = h('div', { class: 'jn-venn' });
    var sql = h('pre', { class: 'code jn-sql' });
    var lt = api.table({ titulo: L.nombre, serie: L.serie, columnas: L.cols, filas: L.filas });
    var rt = api.table({ titulo: R.nombre, serie: R.serie, columnas: R.cols, filas: R.filas });
    [[lt, L], [rt, R]].forEach(function (p) {
      p[0].head[p[1].k].classList.add('jn-key');
      p[0].cells.forEach(function (row) { row[p[1].k].classList.add('jn-key'); });
    });
    var lines = s('svg', { class: 'jn-lines', 'aria-hidden': 'true' });
    var pair = h('div', { class: 'jn-pair' }, [lt.table, h('div', { class: 'jn-gap' }), rt.table, lines]);
    var resBox = h('div', { class: 'jn-res' });
    var note = h('p', { class: 'jn-note' });

    el.appendChild(h('div', { class: 'jn-top' }, [h('div', { class: 'jn-ctrl' }, [picker, sql]), vennBox]));
    el.appendChild(h('div', { class: 'viz-scroll' }, pair));
    el.appendChild(resBox);
    el.appendChild(note);

    var rtab = null;
    function rebuild() {
      res = compute(tipo);
      Object.keys(btns).forEach(function (t) { btns[t].setAttribute('aria-pressed', t === tipo ? 'true' : 'false'); });
      sql.textContent = '';
      var kw = function (t) { return h('span', { class: 'k' }, t); };
      sql.appendChild(h('code', null, [kw('SELECT'), ' * ', kw('FROM'), ' ' + L.nombre + '\n', kw(tipo + ' JOIN'), ' ' + R.nombre,
        tipo === 'CROSS' ? '' : ['\n  ', kw('ON'), ' ' + L.nombre + '.' + L.clave + ' = ' + R.nombre + '.' + R.clave], ';']));
      venn();
      var cols = L.cols.map(function (c) { return { nombre: c.nombre, tipo: c.tipo, serie: L.serie }; })
        .concat(R.cols.map(function (c) { return { nombre: c.nombre, tipo: c.tipo, serie: R.serie }; }));
      var filas = res.map(function (x) {
        var lf = x.l === null ? L.cols.map(function () { return null; }) : L.filas[x.l];
        var rf = x.r === null ? R.cols.map(function () { return null; }) : R.filas[x.r];
        return lf.concat(rf);
      });
      rtab = api.table({ titulo: 'resultado: ' + res.length + (res.length === 1 ? ' fila' : ' filas'), serie: 'r', columnas: cols, filas: filas });
      res.forEach(function (x, i) {
        var pad = x.l === null ? [0, L.cols.length] : (x.r === null ? [L.cols.length, L.cols.length + R.cols.length] : null);
        if (pad) for (var j = pad[0]; j < pad[1]; j++) rtab.cells[i][j].classList.add('jn-pad');
      });
      resBox.textContent = '';
      resBox.appendChild(rtab.wrap);
      note.textContent = L.nombre + ': ' + L.filas.length + ' filas · ' + R.nombre + ': ' + R.filas.length +
        ' filas → resultado: ' + res.length + ' filas. El diagrama indica qué filas se conservan, no cuántas: si una clave se repite, cada coincidencia genera una fila.';
    }

    function venn() {
      vennBox.textContent = '';
      var id = api.id('jn-clip');
      var A = { cx: 44, cy: 34, r: 26 }, B = { cx: 76, cy: 34, r: 26 };
      var fill = { fill: 'var(--hl-soft)' };
      var g = s('svg', { viewBox: '0 0 120 76', role: 'img', 'aria-label': 'Diagrama de ' + tipo + ' JOIN' });
      g.appendChild(s('defs', null, s('clipPath', { id: id }, s('circle', B))));
      if (tipo === 'LEFT' || tipo === 'FULL' || tipo === 'CROSS') g.appendChild(s('circle', Object.assign({ style: fill }, A)));
      if (tipo === 'RIGHT' || tipo === 'FULL' || tipo === 'CROSS') g.appendChild(s('circle', Object.assign({ style: fill }, B)));
      if (tipo === 'INNER') g.appendChild(s('circle', Object.assign({ style: fill, 'clip-path': 'url(#' + id + ')' }, A)));
      g.appendChild(s('circle', Object.assign({ style: { fill: 'none', stroke: api.color(L.serie), strokeWidth: '2' } }, A)));
      g.appendChild(s('circle', Object.assign({ style: { fill: 'none', stroke: api.color(R.serie), strokeWidth: '2' } }, B)));
      if (tipo === 'CROSS') g.appendChild(s('text', { x: 60, y: 40, 'text-anchor': 'middle', style: { fill: 'var(--ink)', font: '600 16px var(--mono)' } }, '×'));
      g.appendChild(s('text', { x: 60, y: 74, 'text-anchor': 'middle', style: { fill: 'var(--muted)', font: '9px var(--display)' } },
        tipo === 'CROSS' ? 'todas × todas' : L.nombre + ' · ' + R.nombre));
      vennBox.appendChild(g);
    }

    function draw(ctx) {
      lines.textContent = '';
      var pr = pair.getBoundingClientRect();
      if (!pr.width) return;
      lines.setAttribute('viewBox', '0 0 ' + pr.width + ' ' + pr.height);
      lines.setAttribute('width', pr.width);
      lines.setAttribute('height', pr.height);
      var x1 = lt.table.getBoundingClientRect().right - pr.left;
      var x2 = rt.table.getBoundingClientRect().left - pr.left;
      function y(tr) { var r = tr.getBoundingClientRect(); return r.top - pr.top + r.height / 2; }
      for (var i = 0; i < cur; i++) {
        var x = res[i];
        if (x.l === null || x.r === null) continue;
        var now = i === cur - 1;
        if (x.kind === 'cross' && !now) continue;
        var y1 = y(lt.rows[x.l]), y2 = y(rt.rows[x.r]), mx = (x1 + x2) / 2;
        var path = s('path', {
          d: 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2,
          class: now ? 'jn-line now' : 'jn-line'
        });
        lines.appendChild(path);
        if (now && ctx && ctx.animate && path.getTotalLength) {
          var len = path.getTotalLength();
          path.style.strokeDasharray = len;
          api.animate(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 520 }, ctx);
        }
      }
    }

    function caption(n) {
      if (n === 0) return tipo + ' JOIN: el resultado tendrá ' + res.length + (res.length === 1 ? ' fila' : ' filas') + '. Avanza para construirlo fila a fila.';
      var x = res[n - 1], p = 'Fila ' + n + ': ';
      var lname = x.l === null ? '' : show(L.filas[x.l][L.lab]);
      var rname = x.r === null ? '' : show(R.filas[x.r][R.lab]);
      if (x.kind === 'cross') return p + lname + ' × ' + rname + '. CROSS JOIN combina cada fila con todas, sin comparar claves.';
      if (x.kind === 'match') {
        var kv = show(L.filas[x.l][L.k]);
        var t = p + lname + ' (' + L.clave + ' = ' + kv + ') coincide con ' + rname + ' (' + R.clave + ' = ' + kv + ').';
        if (x.occ > 1) t += ' Es la coincidencia n.º ' + x.occ + ' de ' + lname + ': su fila se repite en el resultado.';
        return t;
      }
      if (x.kind === 'left') {
        var lk = L.filas[x.l][L.k];
        return p + lname + ' (' + L.clave + ' = ' + show(lk) + ') no coincide con nada' +
          (lk === null ? ': una clave NULL nunca coincide, ni siquiera con otro NULL' : '') +
          '. ' + tipo + ' JOIN la conserva y rellena con NULL las columnas de ' + R.nombre + '.';
      }
      var rk = R.filas[x.r][R.k];
      return p + rname + ' (' + R.clave + ' = ' + show(rk) + ') no tiene pareja en ' + L.nombre +
        (rk === null ? ' (una clave NULL nunca coincide)' : '') + '. ' + tipo + ' JOIN la conserva y rellena con NULL las columnas de ' + L.nombre + '.';
    }

    function setStep(n, ctx) {
      cur = Math.max(0, Math.min(n, res.length));
      var x = cur > 0 ? res[cur - 1] : null;
      lt.rows.forEach(function (tr, i) { tr.classList.toggle('hl', !!x && x.l === i); });
      rt.rows.forEach(function (tr, j) { tr.classList.toggle('hl', !!x && x.r === j); });
      rtab.rows.forEach(function (tr, i) {
        tr.classList.toggle('jn-pend', i >= cur);
        tr.classList.toggle('hl', i === cur - 1);
      });
      if (x && ctx && ctx.animate) {
        api.animate(rtab.rows[cur - 1], [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 200 }, ctx);
      }
      draw(ctx);
      api.caption(caption(cur));
    }

    function choose(t) {
      if (t === tipo) return;
      tipo = t;
      rebuild();
      api.stepsChanged();
    }

    rebuild();
    var ro = window.ResizeObserver ? new ResizeObserver(function () { draw(null); }) : null;
    if (ro) ro.observe(pair);
    return {
      get steps() { return res.length; },
      setStep: setStep,
      destroy: function () { if (ro) ro.disconnect(); el.textContent = ''; }
    };
  }
});
