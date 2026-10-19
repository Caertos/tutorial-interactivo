/* viz: maquina — 1 to 4 input balls drop into a box with the operation; a result ball emerges. */
Viz.register('maquina', {
  render: function (el, cfg, api) {
    var h = api.el;
    var entradas = (cfg.entradas || []).slice(0, 4);
    var salida = cfg.salida || { valor: '?', rol: 'r' };
    var balls = entradas.map(function (e, i) {
      return h('div', { class: 'ball in ' + (e.rol || ['a', 'b', 'c', 'd'][i]), style: { '--k': i } }, String(e.valor));
    });
    var box = h('div', { class: 'maq-box' }, [
      h('div', { class: 'maq-name' }, cfg.nombre || ''),
      h('div', { class: 'maq-op' }, api.segs(cfg.operacion))
    ]);
    var out = h('div', { class: 'ball out ' + (salida.rol || 'r') }, String(salida.valor));
    var machine = h('div', { class: 'maq' + (balls.length === 1 ? ' one' : ''), 'aria-hidden': 'true', style: { '--n': balls.length } }, [
      h('div', { class: 'maq-inputs' }, balls),
      box,
      h('div', { class: 'maq-chute' }),
      h('div', { class: 'maq-out' }, out)
    ]);
    el.appendChild(machine);
    if (cfg.llamada) {
      el.appendChild(h('p', { class: 'maq-pie' }, [
        h('code', null, api.segs(cfg.llamada)), ' ', cfg.verbo || 'devuelve', ' ',
        h('span', { class: 'tag ' + (salida.rol || 'r') }, String(salida.valor))
      ]));
    }

    function aim() {
      var b = box.getBoundingClientRect();
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      balls.forEach(function (ball) {
        var r = ball.getBoundingClientRect();
        ball.style.setProperty('--dx', Math.round((cx - (r.left + r.width / 2)) * 0.6) + 'px');
        ball.style.setProperty('--dy', Math.round(cy - (r.top + r.height / 2)) + 'px');
      });
    }
    return {
      steps: 0,
      reset: function () { machine.classList.remove('run'); },
      play: function () {
        machine.classList.remove('run');
        aim();
        api.reflow(machine);
        machine.classList.add('run');
      },
      destroy: function () { el.textContent = ''; }
    };
  }
});
