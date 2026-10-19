/* viz: capas — layered data flow. A packet travels hop by hop between layers (request lane and
   response lane); a panel shows what the active layer does and the payload shape at that point.
   An optional final step shows a safe, structured mock of what the client renders. */
Viz.register('capas', {
  render: function (el, cfg, api) {
    var h = api.el, s = api.svg;
    var capas = cfg.capas || [];
    if (capas.length < 2) throw new Error('«capas» necesita al menos dos capas: "capas": [{ "id": "nav", "nombre": "Navegador" }, …].');
    var idx = {};
    capas.forEach(function (c, i) {
      if (!c.id) throw new Error('Cada capa necesita un "id" (capa n.º ' + (i + 1) + ').');
      idx[c.id] = i;
    });
    var pasos = cfg.pasos || [];
    pasos.forEach(function (p, i) {
      if (!(p.desde in idx) || !(p.hacia in idx)) throw new Error('El paso ' + (i + 1) + ' usa una capa que no existe: «' + p.desde + '» → «' + p.hacia + '».');
    });
    var horiz = cfg.orientacion === 'horizontal';
    var mock = cfg.render || null;
    var total = pasos.length + (mock ? 1 : 0);
    var cur = 0;

    /* ---------- static DOM ---------- */
    var cards = capas.map(function (c, i) {
      return h('li', { class: 'cp-layer', style: { '--col': c.color ? api.color(c.color) : 'var(--line)' } }, [
        h('span', { class: 'cp-name' }, c.nombre || c.id),
        c.detalle ? h('span', { class: 'cp-det' }, c.detalle) : null
      ]);
    });
    var stack = h('ol', { class: 'cp-stack' }, cards);
    var tracks = s('svg', { class: 'cp-tracks', 'aria-hidden': 'true' });
    var pkt = h('span', { class: 'cp-pkt', 'aria-hidden': 'true' });
    var stage = h('div', { class: 'cp-stage' }, [stack, tracks, pkt]);
    var panel = h('div', { class: 'cp-panel' });
    var legend = h('p', { class: 'cp-legend', 'aria-hidden': 'true' }, [
      h('span', { class: 'cp-key ida' }), 'ida', h('span', { class: 'cp-key vuelta' }), 'vuelta'
    ]);
    var root = h('div', { class: 'cp ' + (horiz ? 'cp-h' : 'cp-v') }, [
      h('div', { class: 'cp-left' }, [horiz ? h('div', { class: 'viz-scroll' }, stage) : stage, legend]), panel
    ]);
    el.appendChild(root);

    function dirOf(p) { return idx[p.hacia] >= idx[p.desde] ? 'ida' : 'vuelta'; }

    /* layer center along the flow axis and the two lane coordinates, in stage pixels */
    function geom() {
      var sr = stage.getBoundingClientRect();
      if (!sr.width) return null;
      var centers = cards.map(function (c) {
        var r = c.getBoundingClientRect();
        return horiz ? r.left - sr.left + r.width / 2 : r.top - sr.top + r.height / 2;
      });
      var lanes = horiz ? { ida: 12, vuelta: sr.height - 12 } : { ida: 13, vuelta: sr.width - 13 };
      return { w: sr.width, h: sr.height, c: centers, lanes: lanes };
    }
    function pt(g, layer, lane) {
      var a = g.c[idx[layer]], b = g.lanes[lane];
      return horiz ? [a, b] : [b, a];
    }

    function drawTracks(g, upto) {
      tracks.textContent = '';
      tracks.setAttribute('viewBox', '0 0 ' + g.w + ' ' + g.h);
      tracks.setAttribute('width', g.w);
      tracks.setAttribute('height', g.h);
      ['ida', 'vuelta'].forEach(function (lane) {
        var a = pt(g, capas[0].id, lane), b = pt(g, capas[capas.length - 1].id, lane);
        tracks.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'cp-lane' }));
        capas.forEach(function (c) {
          var p = pt(g, c.id, lane);
          tracks.appendChild(s('circle', { cx: p[0], cy: p[1], r: 3, class: 'cp-stop' }));
        });
      });
      var nowPath = null;
      for (var i = 0; i < Math.min(upto, pasos.length); i++) {
        var p = pasos[i], lane = dirOf(p);
        var a = pt(g, p.desde, lane), b = pt(g, p.hacia, lane);
        var now = i === upto - 1 && upto <= pasos.length;
        var line = s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'cp-hop-line ' + lane + (now ? ' now' : '') });
        if (now) line.setAttribute('marker-end', api.marker(tracks, 'var(--hl)', { size: 9 }));
        tracks.appendChild(line);
        if (now) nowPath = line;
      }
      return nowPath;
    }

    /* cancel running animations on a node; true if one was still running (rapid stepping) */
    function stop(node) {
      var busy = false;
      if (node.getAnimations) node.getAnimations().forEach(function (a) { if (a.playState === 'running') busy = true; a.cancel(); });
      return busy;
    }

    function placePkt(g, n, ctx) {
      stop(pkt);
      var last = Math.min(n, pasos.length);
      if (last === 0) { pkt.classList.remove('on'); return; }
      var p = pasos[last - 1], lane = dirOf(p);
      var b = pt(g, p.hacia, lane);
      pkt.classList.add('on');
      pkt.style.transform = 'translate(' + b[0] + 'px,' + b[1] + 'px)';
      if (ctx && ctx.animate && n <= pasos.length) {
        var a = pt(g, p.desde, lane);
        api.animate(pkt, [{ transform: 'translate(' + a[0] + 'px,' + a[1] + 'px)' }, { transform: 'translate(' + b[0] + 'px,' + b[1] + 'px)' }],
          { duration: 650, easing: 'cubic-bezier(.45,0,.2,1)' }, ctx);
      }
    }

    function hopText(p) {
      var a = capas[idx[p.desde]], b = capas[idx[p.hacia]];
      return (a.nombre || a.id) + ' → ' + (b.nombre || b.id);
    }

    function mockNode() {
      var items = (mock.items || []).map(function (it) {
        if (it && typeof it === 'object') return h('li', null, [h('span', null, String(it.texto == null ? '' : it.texto)), it.detalle != null ? h('span', { class: 'cp-mock-dim' }, String(it.detalle)) : null]);
        return h('li', null, h('span', null, String(it)));
      });
      return h('div', { class: 'cp-mock', role: 'img', 'aria-label': 'Vista que recibe el usuario: ' + (mock.titulo || '') }, [
        h('div', { class: 'cp-mock-bar' }, [h('span', { class: 'cp-mock-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
          h('span', { class: 'cp-mock-url' }, mock.url || '')]),
        h('div', { class: 'cp-mock-page' }, [
          mock.titulo ? h('p', { class: 'cp-mock-title' }, String(mock.titulo)) : null,
          mock.texto ? h('p', { class: 'cp-mock-text' }, String(mock.texto)) : null,
          items.length ? h('ul', { class: 'cp-mock-list' }, items) : null,
          mock.nota ? h('p', { class: 'cp-mock-note' }, String(mock.nota)) : null
        ])
      ]);
    }

    function fillPanel(n) {
      panel.textContent = '';
      if (n === 0) {
        panel.appendChild(h('p', { class: 'cp-hop' }, total + (total === 1 ? ' paso' : ' pasos')));
        panel.appendChild(h('p', { class: 'cp-intro' }, cfg.titulo || 'El panel mostrará qué hace cada capa con los datos y qué forma tienen al salir de ella.'));
        return;
      }
      if (n > pasos.length) {
        var layer = capas[idx[mock.capa] != null ? idx[mock.capa] : 0];
        panel.appendChild(h('p', { class: 'cp-hop' }, [h('span', { class: 'cp-badge render' }, 'resultado'), ' ' + (layer.nombre || layer.id)]));
        if (mock.etiqueta) panel.appendChild(h('p', { class: 'cp-label' }, String(mock.etiqueta)));
        panel.appendChild(mockNode());
        return;
      }
      var p = pasos[n - 1], lane = dirOf(p);
      panel.appendChild(h('p', { class: 'cp-hop' }, [h('span', { class: 'cp-badge ' + lane }, lane), ' ' + hopText(p),
        h('span', { class: 'cp-count' }, n + '/' + total)]));
      if (p.etiqueta) panel.appendChild(h('p', { class: 'cp-label' }, api.segs(p.etiqueta)));
      if (p.payload) panel.appendChild(api.code({ lang: p.payload.lang, codigo: p.payload.codigo, titulo: p.payload.titulo || 'Forma de los datos' }));
      else if (p.hace) panel.appendChild(h('p', { class: 'cp-intro' }, String(p.hace)));
    }

    function setStep(n, ctx) {
      cur = Math.max(0, Math.min(n, total));
      var p = cur > 0 && cur <= pasos.length ? pasos[cur - 1] : null;
      var activeId = p ? p.hacia : (cur > pasos.length && mock ? (mock.capa || capas[0].id) : null);
      var seen = {};
      for (var i = 0; i < Math.min(cur, pasos.length); i++) { seen[pasos[i].desde] = 1; seen[pasos[i].hacia] = 1; }
      cards.forEach(function (c, i) {
        var id = capas[i].id;
        c.classList.toggle('now', id === activeId);
        c.classList.toggle('from', !!p && id === p.desde);
        c.classList.toggle('seen', !!seen[id]);
      });
      fillPanel(cur);
      var g = geom();
      if (g) {
        var line = drawTracks(g, cur);
        placePkt(g, cur, ctx);
        if (line && ctx && ctx.animate) {
          var len = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
          line.style.strokeDasharray = len + ' ' + len;
          api.animate(line, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 650, easing: 'cubic-bezier(.45,0,.2,1)' }, ctx);
        }
      }
      /* the panel always shows the current step: a new step cancels the previous fade, and while
         stepping quickly the fade has no delay so the panel never stays blank */
      var busy = stop(panel);
      if (ctx && ctx.animate && cur > 0) {
        api.animate(panel, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: busy ? 160 : 380, delay: busy ? 0 : 250 }, ctx);
      }
      api.caption(cur === 0 ? (cfg.intro || 'Avanza para seguir el dato capa por capa.') :
        (p ? p.hace || '' : mock.hace || 'Así lo ve el usuario.'));
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () {
      var g = geom(); if (g) { drawTracks(g, cur); placePkt(g, cur, null); }
    }) : null;
    if (ro) ro.observe(stage);
    return {
      steps: total,
      setStep: setStep,
      destroy: function () { if (ro) ro.disconnect(); el.textContent = ''; }
    };
  }
});
