/* viz: antes-despues — compare two states (value, object, list, code, table). Steps:
   1 reveals «después», 2 marks the differences (added / removed / changed, computed here),
   3 (optional) compares identities: same reference or a new one.
   "diff": false is a neutral side-by-side comparison of two alternatives: no marks, no arrow,
   and the differences step is skipped. */
Viz.register('antes-despues', {
  render: function (el, cfg, api) {
    var h = api.el;
    var TIPOS = ['valor', 'objeto', 'lista', 'codigo', 'tabla'];
    var tipo = TIPOS.indexOf(cfg.tipo) >= 0 ? cfg.tipo : 'objeto';
    var A = cfg.antes || {}, B = cfg.despues || {};
    if (!('valor' in A) || !('valor' in B)) throw new Error('«antes-despues» necesita "antes": { "valor": … } y "despues": { "valor": … }.');
    var ref = cfg.referencia || null;
    var textos = cfg.textos || {};
    var alternar = cfg.modo === 'alternar';
    var neutral = cfg.diff === false;
    /* phase names in step order; setStep(n) renders phases[n] */
    var phases = ['intro', 'despues'].concat(neutral ? [] : ['diferencias'], ref ? ['referencia'] : []);
    var steps = phases.length - 1;
    function js(v) { return JSON.stringify(v); }
    function fmt(v) { return typeof v === 'string' ? '"' + v + '"' : (v === undefined ? 'undefined' : js(v)); }

    /* LCS over string keys -> ops [{k:'same'|'del'|'add', a, b}] */
    function lcs(x, y) {
      var n = x.length, m = y.length, T = [];
      for (var i = 0; i <= n; i++) { T.push(new Array(m + 1).fill(0)); }
      for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) T[i][j] = x[i] === y[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
      var ops = []; i = 0; j = 0;
      while (i < n || j < m) {
        if (i < n && j < m && x[i] === y[j]) { ops.push({ k: 'same', a: i++, b: j++ }); }
        else if (j < m && (i >= n || T[i][j + 1] >= T[i + 1][j])) ops.push({ k: 'add', b: j++ });
        else ops.push({ k: 'del', a: i++ });
      }
      return ops;
    }

    /* per side: list of rows {mark: ''|'add'|'del'|'chg', node} */
    function build() {
      var a = A.valor, b = B.valor, L = [], R = [], stats = { add: 0, del: 0, chg: 0 };
      function row(mark, children, cls) { return { mark: mark, node: h('div', { class: 'ad-row ' + (cls || '') }, children) }; }
      if (tipo === 'valor') {
        var ch = js(a) !== js(b);
        if (ch) stats.chg++;
        L.push(row(ch ? 'chg' : '', h('span', { class: 'ad-big' }, fmt(a))));
        R.push(row(ch ? 'chg' : '', h('span', { class: 'ad-big' }, fmt(b))));
      } else if (tipo === 'objeto') {
        var ka = Object.keys(a || {}), kb = Object.keys(b || {});
        L.push(row('', '{', 'ad-brace')); R.push(row('', '{', 'ad-brace'));
        ka.forEach(function (k) {
          var m = !(k in b) ? 'del' : (js(a[k]) !== js(b[k]) ? 'chg' : '');
          if (m) stats[m]++;
          L.push(row(m, [h('span', { class: 'ad-key' }, k), ': ', h('span', { class: 'ad-val' }, fmt(a[k])), ',']));
        });
        kb.forEach(function (k) {
          var m = !(k in a) ? 'add' : (js(a[k]) !== js(b[k]) ? 'chg' : '');
          if (m === 'add') stats.add++;
          R.push(row(m, [h('span', { class: 'ad-key' }, k), ': ', h('span', { class: 'ad-val' }, fmt(b[k])), ',']));
        });
        L.push(row('', '}', 'ad-brace')); R.push(row('', '}', 'ad-brace'));
      } else if (tipo === 'lista' || tipo === 'codigo') {
        var xa = tipo === 'lista' ? (a || []).map(js) : String(a).split('\n');
        var xb = tipo === 'lista' ? (b || []).map(js) : String(b).split('\n');
        var ma = xa.map(function () { return ''; }), mb = xb.map(function () { return ''; });
        /* a run of removed + added lines between two equal lines is a modification: pair them by
           position as «cambiado»; the leftovers stay removed or added */
        var runA = [], runB = [];
        function flush() {
          var k = tipo === 'codigo' ? Math.min(runA.length, runB.length) : 0;
          runA.forEach(function (i, n) { ma[i] = n < k ? 'chg' : 'del'; if (n >= k) stats.del++; });
          runB.forEach(function (j, n) { mb[j] = n < k ? 'chg' : 'add'; if (n >= k) stats.add++; });
          stats.chg += k;
          runA = []; runB = [];
        }
        lcs(xa, xb).forEach(function (o) {
          if (o.k === 'del') runA.push(o.a); else if (o.k === 'add') runB.push(o.b); else flush();
        });
        flush();
        if (tipo === 'lista') {
          var cells = function (arr, marks) {
            return { mark: '', node: h('ol', { class: 'ad-list' }, arr.map(function (v, i) {
              var li = h('li', { class: 'ad-cell' }, [h('span', { class: 'ad-idx' }, String(i)), h('span', { class: 'ad-val' }, fmt(v))]);
              li.dataset.mark = marks[i];
              return li;
            })) };
          };
          L.push(cells(a || [], ma)); R.push(cells(b || [], mb));
        } else {
          xa.forEach(function (t, i) { L.push(row(ma[i], h('code', null, t || ' '), 'ad-code')); });
          xb.forEach(function (t, i) { R.push(row(mb[i], h('code', null, t || ' '), 'ad-code')); });
        }
      } else {
        var cols = a.columnas || b.columnas || [];
        var key = Math.max(0, cols.map(function (c) { return typeof c === 'string' ? c : c.nombre; }).indexOf(cfg.clave));
        var fa = a.filas || [], fb = b.filas || [];
        var ta = api.table({ titulo: A.titulo, columnas: cols, filas: fa }), tb = api.table({ titulo: B.titulo, columnas: b.columnas || cols, filas: fb });
        var idxB = {}; fb.forEach(function (f, i) { idxB[js(f[key])] = i; });
        var idxA = {}; fa.forEach(function (f, i) { idxA[js(f[key])] = i; });
        var tm = { L: [], R: [] };
        fa.forEach(function (f, i) {
          var j = idxB[js(f[key])];
          if (j == null) { tm.L.push([ta.rows[i], 'del']); stats.del++; return; }
          f.forEach(function (v, c) { if (js(v) !== js(fb[j][c])) { tm.L.push([ta.cells[i][c], 'chg']); tm.R.push([tb.cells[j][c], 'chg']); stats.chg++; } });
        });
        fb.forEach(function (f, j) { if (idxA[js(f[key])] == null) { tm.R.push([tb.rows[j], 'add']); stats.add++; } });
        L.push({ mark: '', node: ta.wrap, tableMarks: tm.L }); R.push({ mark: '', node: tb.wrap, tableMarks: tm.R });
      }
      return { L: L, R: R, stats: stats };
    }
    var D = build();

    function panel(side, spec, rows) {
      var idTag = ref ? h('span', { class: 'ad-id' }, side === 'L' ? (ref.idAntes || 'objeto #1') : (ref.idDespues || (ref.misma ? (ref.idAntes || 'objeto #1') : 'objeto #2'))) : null;
      var body = h('div', { class: 'ad-body ad-' + tipo }, rows.map(function (r) {
        if (r.mark) r.node.dataset.mark = r.mark;
        return r.node;
      }));
      var dflt = neutral ? (side === 'L' ? 'Opción A' : 'Opción B') : (side === 'L' ? 'Antes' : 'Después');
      var node = h('section', { class: 'ad-panel ' + (side === 'L' ? 'antes' : 'despues') }, [
        h('header', { class: 'ad-head' }, [h('span', { class: 'ad-title' }, spec.titulo || dflt), idTag]),
        spec.codigo ? h('p', { class: 'ad-expr' }, String(spec.codigo)) : null,
        tipo === 'tabla' ? body : h('div', { class: 'viz-scroll' }, body)
      ]);
      return { node: node, id: idTag };
    }
    var PL = panel('L', A, D.L), PR = panel('R', B, D.R);
    var toggle = null, btnA, btnB, showing = 'antes';
    if (alternar) {
      btnA = h('button', { type: 'button', class: 'viz-btn', 'aria-pressed': 'true', onclick: function () { show('antes'); } }, A.titulo || (neutral ? 'Opción A' : 'Antes'));
      btnB = h('button', { type: 'button', class: 'viz-btn', 'aria-pressed': 'false', onclick: function () { show('despues'); } }, B.titulo || (neutral ? 'Opción B' : 'Después'));
      toggle = h('div', { class: 'ad-toggle', role: 'group', 'aria-label': 'Ver estado' }, [btnA, btnB]);
    }
    var cmp = h('p', { class: 'ad-cmp' });
    var legend = h('p', { class: 'ad-legend', 'aria-hidden': 'true' }, [
      h('span', { 'data-mark': 'add' }, '+ añadido'), h('span', { 'data-mark': 'del' }, '− eliminado'), h('span', { 'data-mark': 'chg' }, '~ cambiado')
    ]);
    var wrap = h('div', { class: 'ad' + (alternar ? ' alt' : '') + (neutral ? ' neutral' : '') }, [toggle,
      h('div', { class: 'ad-pair' }, [PL.node, neutral ? null : h('span', { class: 'ad-arrow', 'aria-hidden': 'true' }, '→'), PR.node]),
      neutral ? null : legend, cmp]);
    el.appendChild(wrap);

    function show(which) {
      showing = which;
      if (!alternar) return;
      btnA.setAttribute('aria-pressed', which === 'antes' ? 'true' : 'false');
      btnB.setAttribute('aria-pressed', which === 'despues' ? 'true' : 'false');
      PL.node.hidden = which !== 'antes';
      PR.node.hidden = which !== 'despues';
    }

    function marks(on) {
      [[PL, D.L], [PR, D.R]].forEach(function (pr) {
        pr[0].node.classList.toggle('marked', on);
        pr[1].forEach(function (r) {
          (r.tableMarks || []).forEach(function (t) {
            var cls = t[1] === 'chg' ? 'hl-cell' : 'ad-t-' + t[1];
            t[0].classList.toggle(cls, on);
          });
        });
      });
      legend.classList.toggle('on', on);
    }

    function summary() {
      var st = D.stats, parts = [];
      if (st.add) parts.push(st.add + (st.add === 1 ? ' añadido' : ' añadidos'));
      if (st.del) parts.push(st.del + (st.del === 1 ? ' eliminado' : ' eliminados'));
      if (st.chg) parts.push(st.chg + (st.chg === 1 ? ' cambiado' : ' cambiados'));
      return parts.length ? 'Diferencias: ' + parts.join(', ') + '.' : 'No hay diferencias de contenido.';
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, steps));
      var phase = phases[n], refOn = phase === 'referencia';
      PR.node.classList.toggle('pend', n < 1);
      marks(!neutral && n >= 2);
      if (alternar) show(n >= 1 ? 'despues' : 'antes');
      cmp.textContent = '';
      cmp.classList.toggle('on', refOn);
      [PL, PR].forEach(function (p) { if (p.id) p.id.classList.toggle('on', refOn); });
      if (ref && refOn) {
        cmp.appendChild(h('code', null, ref.expresion || 'antes === despues'));
        cmp.appendChild(h('span', { class: 'ad-arrow2', 'aria-hidden': 'true' }, ' → '));
        cmp.appendChild(h('span', { class: 'tag ' + (ref.misma ? 'r' : 'b') }, ref.misma ? 'true' : 'false'));
        cmp.appendChild(h('span', { class: 'ad-cmp-t' }, ref.misma ? ' misma referencia: los dos nombres apuntan al mismo objeto' : ' referencia nueva: es otro objeto en memoria'));
      }
      if (ctx && ctx.animate) {
        if (n === 1) api.animate(PR.node, [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 420 }, ctx);
        if (refOn) api.animate(cmp, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380 }, ctx);
      }
      var cap = {
        intro: textos.intro || (neutral ? 'Esta es la primera opción.' : 'Este es el estado inicial.'),
        despues: textos.despues || (neutral ? 'Y esta, la segunda: compáralas lado a lado.' : 'Así queda después del cambio.'),
        diferencias: textos.diferencias || summary(),
        referencia: textos.referencia || ''
      }[phase];
      api.caption(cap);
    }
    return { steps: steps, setStep: setStep };
  }
});
