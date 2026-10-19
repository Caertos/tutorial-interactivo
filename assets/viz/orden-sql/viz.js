/* viz: orden-sql — logical execution order of a SELECT. The query text is shown as written;
   each step activates the next stage (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT),
   highlights its fragment and shows the intermediate table given in config (from a real engine). */
Viz.register('orden-sql', {
  render: function (el, cfg, api) {
    var h = api.el;
    var ORDEN = ['from', 'join', 'where', 'group', 'having', 'window', 'select', 'distinct', 'order', 'limit'];
    var NOMBRES = { from: 'FROM', join: 'JOIN', where: 'WHERE', group: 'GROUP BY', having: 'HAVING', window: 'WINDOW', select: 'SELECT', distinct: 'DISTINCT', order: 'ORDER BY', limit: 'LIMIT' };
    var etapas = cfg.etapas || [];
    var last = -1;
    etapas.forEach(function (e) {
      var k = ORDEN.indexOf(e.id);
      if (k < 0) throw new Error('etapa desconocida «' + e.id + '»; usa: ' + ORDEN.join(', '));
      if (k <= last) throw new Error('las etapas deben ir en orden lógico: ' + ORDEN.join(' → '));
      last = k;
    });
    var execNum = {};
    etapas.forEach(function (e, i) { execNum[e.id] = i + 1; });

    /* query as written, one span per fragment */
    var frags = {};
    var code = h('code', null, (cfg.consulta || []).map(function (seg) {
      var text = Array.isArray(seg) ? seg[0] : String(seg);
      var id = Array.isArray(seg) ? seg[1] : '';
      if (!id || !execNum[id]) return document.createTextNode(text);
      var lead = text.match(/^\s*/)[0];
      var n = h('span', { class: 'osql-n', 'aria-hidden': 'true' }, String(execNum[id]));
      var span = h('span', { class: 'osql-frag' }, [n, text.slice(lead.length)]);
      (frags[id] = frags[id] || []).push(span);
      return [lead, span];
    }));
    var pre = h('pre', { class: 'code osql-q', 'aria-label': 'Consulta tal como se escribe' }, code);

    var chips = etapas.map(function (e, i) {
      return h('li', { class: 'osql-chip' }, [h('span', { class: 'osql-i' }, String(i + 1)), e.nombre || NOMBRES[e.id]]);
    });
    var pipe = h('ol', { class: 'osql-pipe', 'aria-label': 'Orden de ejecución' }, chips);
    var stageBox = h('div', { class: 'osql-stage' });

    el.appendChild(pre);
    el.appendChild(h('div', { class: 'viz-scroll' }, pipe));
    el.appendChild(stageBox);

    function list(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }

    function setStep(n, ctx) {
      etapas.forEach(function (e, i) {
        chips[i].classList.toggle('done', i < n - 1);
        chips[i].classList.toggle('on', i === n - 1);
        (frags[e.id] || []).forEach(function (f) {
          f.classList.toggle('lit', i === n - 1);
          f.classList.toggle('seen', i < n);
        });
      });
      stageBox.textContent = '';
      if (n === 0) {
        api.caption(cfg.intro || 'Así se escribe. Avanza para verla en el orden en que se ejecuta.');
        return;
      }
      var e = etapas[n - 1], tb = e.tabla || {};
      var t = api.table({ titulo: tb.titulo || ('tras ' + (e.nombre || NOMBRES[e.id])), serie: tb.serie || 'r', columnas: tb.columnas || [], filas: tb.filas || [] });
      var strike = list(tb.tachar), grupos = tb.grupos || [], hlc = list(tb.resaltarColumna);
      var kept = 0;
      t.rows.forEach(function (tr, i) {
        if (strike.indexOf(i) < 0) kept++;
        if (grupos[i] != null) { tr.classList.add('osql-grp'); tr.style.setProperty('--grp', api.color(Number(grupos[i]) + 1)); }
      });
      t.cols.forEach(function (c, j) {
        if (hlc.indexOf(c.nombre) < 0) return;
        t.head[j].classList.add('hl-col');
        t.cells.forEach(function (r) { r[j].classList.add('hl-col'); });
      });
      var total = t.rows.length;
      stageBox.appendChild(t.wrap);
      stageBox.appendChild(h('p', { class: 'vt-foot' }, strike.length ? 'Quedan ' + kept + ' de ' + total + ' filas' : total + (total === 1 ? ' fila' : ' filas')));
      api.reflow(t.table);
      strike.forEach(function (i) { if (t.rows[i]) t.rows[i].classList.add('strike'); });
      if (ctx && ctx.animate) {
        t.rows.forEach(function (tr, i) {
          api.animate(tr, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 60 * i }, ctx);
        });
      }
      api.caption(e.texto || '');
    }
    return { steps: etapas.length, setStep: setStep };
  }
});
