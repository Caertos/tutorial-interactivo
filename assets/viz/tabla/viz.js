/* viz: tabla — a data table with typed columns, PK/FK badges, distinct NULLs and
   config-driven steps: highlight rows/columns/cells (current step only),
   dim/strike rows and add computed columns (cumulative). */
Viz.register('tabla', {
  render: function (el, cfg, api) {
    var h = api.el;
    var pasos = cfg.pasos || [];
    var baseCols = (cfg.columnas || []).map(function (c) { return typeof c === 'string' ? { nombre: c } : c; });
    var filas = cfg.filas || [];
    var holder = h('div');
    var foot = h('p', { class: 'vt-foot' });
    el.appendChild(holder);
    if (cfg.mostrarConteo !== false) el.appendChild(foot);

    function list(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }

    /* state after applying steps 1..n */
    function stateAt(n) {
      var st = { fila: {}, cols: {}, celdas: {}, nuevas: [] };
      for (var i = 0; i < n; i++) {
        var p = pasos[i] || {};
        if (p.restaurar) st.fila = {};
        list(p.atenuar).forEach(function (r) { st.fila[r] = 'dim'; });
        list(p.tachar).forEach(function (r) { st.fila[r] = 'strike'; });
        if (p.columnaNueva) st.nuevas.push(Object.assign({ paso: i + 1 }, p.columnaNueva));
      }
      var cur = n > 0 ? (pasos[n - 1] || {}) : {};
      st.hlFilas = list(cur.resaltarFilas);
      list(cur.resaltarColumna).forEach(function (c) { st.cols[c] = true; });
      list(cur.resaltarCeldas).forEach(function (rc) { st.celdas[rc[0] + '|' + rc[1]] = true; });
      return st;
    }

    var view = null;
    function build(st) {
      var cols = baseCols.concat(st.nuevas.map(function (c) {
        return { nombre: c.nombre, tipo: c.tipo, serie: c.serie, nueva: c.paso, rol: c.rol || 'r' };
      }));
      var rows = filas.map(function (f, i) {
        return f.concat(st.nuevas.map(function (c) { return (c.valores || [])[i] === undefined ? null : c.valores[i]; }));
      });
      var t = api.table({ titulo: cfg.nombre, serie: cfg.serie || 1, columnas: cols, filas: rows });
      cols.forEach(function (c, j) {
        if (!c.nueva) return;
        t.head[j].style.setProperty('--col', api.color(c.rol));
        t.head[j].classList.add('vt-new');
      });
      holder.textContent = '';
      holder.appendChild(t.wrap);
      view = { t: t, cols: cols };
    }

    function paint(st) {
      var t = view.t, cols = view.cols, kept = 0;
      t.rows.forEach(function (tr, i) {
        var f = st.fila[i];
        tr.classList.toggle('dim', f === 'dim');
        tr.classList.toggle('strike', f === 'strike');
        tr.classList.toggle('hl', st.hlFilas.indexOf(i) >= 0);
        if (f !== 'strike') kept++;
        cols.forEach(function (c, j) {
          var td = t.cells[i][j];
          td.classList.toggle('hl-col', !!st.cols[c.nombre]);
          td.classList.toggle('hl-cell', !!st.celdas[i + '|' + c.nombre]);
        });
      });
      cols.forEach(function (c, j) { t.head[j].classList.toggle('hl-col', !!st.cols[c.nombre]); });
      var total = filas.length;
      foot.textContent = kept === total ? total + (total === 1 ? ' fila' : ' filas')
        : 'Quedan ' + kept + ' de ' + total + ' filas';
    }

    function setStep(n, ctx) {
      var st = stateAt(n);
      build(st);
      var animate = ctx && ctx.animate && n > 0;
      if (animate) {
        /* paint the previous state, then transition to the current one */
        var prev = stateAt(n - 1);
        prev.nuevas = st.nuevas;
        paint(prev);
        var j = view.cols.length - 1;
        if (view.cols[j] && view.cols[j].nueva === n) {
          var cells = [view.t.head[j]].concat(view.t.cells.map(function (r) { return r[j]; }));
          cells.forEach(function (c, k) {
            api.animate(c, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: k * 70 }, ctx);
          });
        }
        api.reflow(view.t.table);
      }
      paint(st);
      api.caption(n === 0 ? (cfg.intro || '') : (pasos[n - 1].texto || ''));
    }
    return { steps: pasos.length, setStep: setStep };
  }
});
