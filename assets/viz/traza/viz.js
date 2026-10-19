/* viz: traza — execution trace; one line per step, revealed one at a time with a caption. */
Viz.register('traza', {
  render: function (el, cfg, api) {
    var h = api.el;
    var pasos = cfg.pasos || [];
    var flecha = cfg.flecha || '=';
    var rows = pasos.map(function (p, i) {
      var salida = Array.isArray(p.salida)
        ? h('span', { class: 'tr-out' }, api.segs(p.salida))
        : h('span', { class: 'tag ' + (p.rol || 'r') }, String(p.salida == null ? '' : p.salida));
      return h('li', { class: 'tr-row' }, [
        h('span', { class: 'tr-label muted' }, p.etiqueta || ('Paso ' + (i + 1))),
        h('span', { class: 'tr-in' }, api.segs(p.entrada)),
        p.salida == null ? null : h('span', { class: 'tr-eq' }, flecha),
        p.salida == null ? null : salida
      ]);
    });
    var list = h('ol', { class: 'tr' }, rows);
    el.appendChild(h('div', { class: 'viz-scroll' }, list));

    function setStep(n, ctx) {
      rows.forEach(function (r, i) {
        r.classList.toggle('on', i < n);
        r.classList.toggle('now', i === n - 1);
        r.setAttribute('aria-hidden', i < n ? 'false' : 'true');
      });
      if (n > 0 && ctx && ctx.animate) {
        api.animate(rows[n - 1], [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420 }, ctx);
      }
      api.caption(n === 0 ? (cfg.intro || '') : (pasos[n - 1].nota || ''));
    }
    return { steps: pasos.length, setStep: setStep };
  }
});
