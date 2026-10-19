/* viz: grafo — directed graph / DAG with two modes:
   - "generico": nodes + edges, layered layout (longest path from sources, barycenter ordering).
     Steps highlight nodes/edges this step and accumulate "hecho" nodes (numbered).
   - "git": commits on branch lanes, branch and HEAD labels. Steps add commits, move refs and HEAD;
     commits not reachable from any ref or HEAD are dimmed automatically (as git would leave them). */
(function () {
  Viz.register('grafo', {
    render: function (el, cfg, api) {
      return cfg.modo === 'git' ? gitMode(el, cfg, api) : genericMode(el, cfg, api);
    }
  });

  function curve(x1, y1, x2, y2, vertical) {
    if (vertical) { var my = (y1 + y2) / 2; return 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2; }
    var mx = (x1 + x2) / 2;
    return 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2;
  }

  /* ---------------- generic DAG ---------------- */
  function genericMode(el, cfg, api) {
    var s = api.svg;
    var nodos = (cfg.nodos || []).map(function (n) { return { id: String(n.id), etiqueta: String(n.etiqueta || n.id), detalle: n.detalle, serie: n.serie }; });
    if (!nodos.length) throw new Error('«grafo» necesita "nodos": [{ "id": "a", "etiqueta": "app.js" }, …] y "aristas": [{ "desde": "a", "hacia": "b" }].');
    var byId = {};
    nodos.forEach(function (n) { byId[n.id] = n; n.out = []; n.inn = []; });
    var aristas = (cfg.aristas || []).map(function (e, i) {
      if (!byId[e.desde] || !byId[e.hacia]) throw new Error('La arista ' + (i + 1) + ' usa un nodo que no existe: «' + e.desde + '» → «' + e.hacia + '».');
      var a = { desde: e.desde, hacia: e.hacia, etiqueta: e.etiqueta, estilo: e.estilo };
      byId[e.desde].out.push(a); byId[e.hacia].inn.push(a);
      return a;
    });
    var vertical = cfg.direccion !== 'derecha';
    /* layering: longest path from sources; back edges of cycles are ignored */
    var layer = {}, state = {};
    function depth(n) {
      if (layer[n.id] != null) return layer[n.id];
      state[n.id] = 1;
      var d = 0;
      n.inn.forEach(function (e) { var p = byId[e.desde]; if (state[p.id] !== 1) d = Math.max(d, depth(p) + 1); });
      state[n.id] = 2;
      layer[n.id] = d;
      return d;
    }
    nodos.forEach(depth);
    var layers = [];
    nodos.forEach(function (n) { (layers[layer[n.id]] = layers[layer[n.id]] || []).push(n); });
    layers = layers.filter(Boolean);
    function bary(n, dirIn) {
      var nb = dirIn ? n.inn.map(function (e) { return byId[e.desde]; }) : n.out.map(function (e) { return byId[e.hacia]; });
      if (!nb.length) return n._o;
      return nb.reduce(function (a, m) { return a + m._o; }, 0) / nb.length;
    }
    layers.forEach(function (L) { L.forEach(function (n, i) { n._o = i; }); });
    for (var sweep = 0; sweep < 2; sweep++) {
      for (var i = 1; i < layers.length; i++) { layers[i].sort(function (a, b) { return bary(a, true) - bary(b, true); }); layers[i].forEach(function (n, k) { n._o = k; }); }
      for (var j = layers.length - 2; j >= 0; j--) { layers[j].sort(function (a, b) { return bary(a, false) - bary(b, false); }); layers[j].forEach(function (n, k) { n._o = k; }); }
    }
    var hasDet = nodos.some(function (n) { return n.detalle; });
    var NH = hasDet ? 44 : 32;
    nodos.forEach(function (n) { n.w = Math.max(48, Math.max(n.etiqueta.length * 8.1, String(n.detalle || '').length * 6.8) + 22); });
    var GAP = 22, LGAP = vertical ? NH + 52 : 70, PAD = 14;
    var W, H;
    if (vertical) {
      var rowW = layers.map(function (L) { return L.reduce(function (a, n) { return a + n.w; }, 0) + (L.length - 1) * GAP; });
      W = Math.max.apply(null, rowW) + PAD * 2;
      layers.forEach(function (L, li) {
        var x = PAD + (W - PAD * 2 - rowW[li]) / 2;
        L.forEach(function (n) { n.x = x + n.w / 2; n.y = PAD + li * LGAP; x += n.w + GAP; });
      });
      H = PAD * 2 + (layers.length - 1) * LGAP + NH;
    } else {
      var colW = layers.map(function (L) { return Math.max.apply(null, L.map(function (n) { return n.w; })); });
      var colH = layers.map(function (L) { return L.length * NH + (L.length - 1) * 18; });
      H = Math.max.apply(null, colH) + PAD * 2;
      var x = PAD;
      layers.forEach(function (L, li) {
        var y = PAD + (H - PAD * 2 - colH[li]) / 2;
        L.forEach(function (n) { n.x = x + colW[li] / 2; n.y = y; y += NH + 18; });
        x += colW[li] + LGAP;
      });
      W = x - LGAP + PAD;
    }
    var pasos = (cfg.pasos || []).map(function (p) {
      return { actual: p.actual || [], hecho: p.hecho || [], aristas: (p.aristas || []).map(function (e) { return e.join('>'); }), texto: p.texto || '' };
    });
    var box = api.svgBox(W, H, { minScale: 0.85, maxScale: 1.2, label: api.root.getAttribute('aria-label') || 'Grafo dirigido', clase: 'gf' });
    el.appendChild(box.wrap);
    var svg = box.svg;

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      var done = {}, k = 0;
      for (var i = 0; i < n; i++) pasos[i].hecho.forEach(function (id) { if (!(id in done)) done[id] = ++k; });
      var p = n > 0 ? pasos[n - 1] : { actual: [], aristas: [] };
      svg.textContent = ''; svg._markers = null;
      aristas.forEach(function (e) {
        var a = byId[e.desde], b = byId[e.hacia], hl = p.aristas.indexOf(e.desde + '>' + e.hacia) >= 0;
        var d = vertical ? curve(a.x, a.y + NH, b.x, b.y - 2, true) : curve(a.x + a.w / 2, a.y + NH / 2, b.x - b.w / 2 - 2, b.y + NH / 2, false);
        var path = s('path', { d: d, class: 'gf-edge' + (hl ? ' now' : '') + (e.estilo === 'discontinua' ? ' dash' : ''),
          'marker-end': api.marker(svg, hl ? 'var(--hl)' : 'var(--muted)') });
        svg.appendChild(path);
        if (e.etiqueta) {
          var lx = vertical ? (a.x + b.x) / 2 : (a.x + a.w / 2 + b.x - b.w / 2) / 2, ly = vertical ? (a.y + NH + b.y) / 2 : (a.y + b.y) / 2 + NH / 2;
          var tw = String(e.etiqueta).length * 7 + 10;
          svg.appendChild(s('rect', { x: lx - tw / 2, y: ly - 10, width: tw, height: 19, rx: 4, class: 'gf-elbg' }));
          svg.appendChild(s('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', class: 'gf-elbl' }, String(e.etiqueta)));
        }
        if (hl && ctx && ctx.animate && path.getTotalLength) {
          var len = path.getTotalLength();
          path.style.strokeDasharray = len + ' ' + len;
          api.animate(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 480 }, ctx);
        }
      });
      nodos.forEach(function (nd) {
        var now = p.actual.indexOf(nd.id) >= 0;
        var g = s('g', { class: 'gf-node' + (done[nd.id] ? ' done' : '') + (now ? ' now' : ''), transform: 'translate(' + (nd.x - nd.w / 2) + ',' + nd.y + ')' });
        g.appendChild(s('rect', { width: nd.w, height: NH, rx: 8, class: 'gf-box', style: nd.serie && !now ? { stroke: api.color(nd.serie) } : null }));
        g.appendChild(s('text', { x: nd.w / 2, y: nd.detalle ? 18 : NH / 2 + 5, 'text-anchor': 'middle', class: 'gf-lbl' }, nd.etiqueta));
        if (nd.detalle) g.appendChild(s('text', { x: nd.w / 2, y: 35, 'text-anchor': 'middle', class: 'gf-det' }, String(nd.detalle)));
        if (done[nd.id]) {
          g.appendChild(s('circle', { cx: nd.w, cy: 0, r: 9, class: 'gf-ord' }));
          g.appendChild(s('text', { x: nd.w, y: 4, 'text-anchor': 'middle', class: 'gf-ord-t' }, String(done[nd.id])));
        }
        svg.appendChild(g);
        if (now && ctx && ctx.animate) api.animate(g.firstChild, [{ opacity: 0.2 }, { opacity: 1 }], { duration: 380, delay: 200 }, ctx);
      });
      api.caption(n === 0 ? (cfg.intro || 'Avanza para recorrer el grafo.') : p.texto);
    }
    return { steps: pasos.length, setStep: setStep };
  }

  /* ---------------- git ---------------- */
  function gitMode(el, cfg, api) {
    var s = api.svg;
    var ramas = cfg.ramas || [];
    if (!ramas.length) throw new Error('El modo git necesita "ramas": [{ "nombre": "main", "serie": 1 }, …].');
    var laneOf = {};
    ramas.forEach(function (r, i) { laneOf[r.nombre] = i; });
    var pasos = cfg.pasos || [];
    /* every commit ever shown, in order of appearance -> stable columns across steps */
    var commits = [], byId = {};
    function addC(c, step) {
      if (byId[c.id]) throw new Error('El commit «' + c.id + '» está repetido.');
      if (!(c.rama in laneOf)) throw new Error('El commit «' + c.id + '» usa la rama «' + c.rama + '», que no está en "ramas".');
      var o = { id: String(c.id), rama: c.rama, padres: (c.padres || []).map(String), mensaje: c.mensaje || '', step: step, copiaDe: c.copiaDe };
      o.padres.forEach(function (p) { if (!byId[p]) throw new Error('El padre «' + p + '» del commit «' + c.id + '» no existe (declara antes los padres).'); });
      commits.push(o); byId[o.id] = o;
    }
    (cfg.commits || []).forEach(function (c) { addC(c, 0); });
    pasos.forEach(function (p, i) { (p.agregar || []).forEach(function (c) { addC(c, i + 1); }); });
    var used = {};
    commits.forEach(function (c) {
      var x = c.padres.reduce(function (m, p) { return Math.max(m, byId[p].col + 1); }, 0);
      while (used[laneOf[c.rama] + ':' + x]) x++;
      used[laneOf[c.rama] + ':' + x] = 1;
      c.col = x;
    });
    var cols = Math.max.apply(null, commits.map(function (c) { return c.col; })) + 1;
    var CW = 82, LH = 92, PADL = 34, TOP = 84, R = 13;
    var W = PADL * 2 + (cols - 1) * CW + 40, H = TOP + (ramas.length - 1) * LH + 46;
    function cx(c) { return PADL + 20 + c.col * CW; }
    function cy(c) { return TOP + laneOf[c.rama] * LH; }

    function state(n) {
      var st = { refs: Object.assign({}, cfg.refs || {}), head: cfg.head || null, vis: {}, hl: [] };
      commits.forEach(function (c) { if (c.step <= n) st.vis[c.id] = 1; });
      for (var i = 0; i < n; i++) {
        var p = pasos[i];
        Object.keys(p.refs || {}).forEach(function (k) { if (p.refs[k] == null) delete st.refs[k]; else st.refs[k] = String(p.refs[k]); });
        if (p.head !== undefined) st.head = p.head;
      }
      if (n > 0) st.hl = (pasos[n - 1].resaltar || []).map(String);
      /* reachability from refs and HEAD */
      var reach = {}, stack = Object.keys(st.refs).map(function (k) { return st.refs[k]; });
      if (st.head && !(st.head in st.refs)) stack.push(st.head);
      while (stack.length) {
        var id = stack.pop();
        if (!byId[id] || reach[id]) continue;
        reach[id] = 1;
        stack = stack.concat(byId[id].padres);
      }
      st.reach = reach;
      return st;
    }

    var box = api.svgBox(W, H, { minScale: 0.85, maxScale: 1.15, label: api.root.getAttribute('aria-label') || 'Historial de git', clase: 'gf gf-git' });
    el.appendChild(box.wrap);
    var svg = box.svg;

    function tagsAt(st) {
      var at = {};
      Object.keys(st.refs).forEach(function (k) { (at[st.refs[k]] = at[st.refs[k]] || []).push({ ref: k, head: st.head === k }); });
      if (st.head && !(st.head in st.refs) && byId[st.head]) (at[st.head] = at[st.head] || []).unshift({ ref: 'HEAD', head: true, detached: true });
      return at;
    }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      var st = state(n), prev = n > 0 && ctx && ctx.animate ? state(n - 1) : null;
      svg.textContent = '';
      ramas.forEach(function (r, i) {
        svg.appendChild(s('line', { x1: 8, y1: TOP + i * LH, x2: W - 8, y2: TOP + i * LH, class: 'gf-lane' }));
      });
      commits.forEach(function (c) {
        if (!st.vis[c.id]) return;
        c.padres.forEach(function (pid) {
          var p = byId[pid];
          var dim = !st.reach[c.id];
          var path = s('path', { d: cy(p) === cy(c) ? 'M' + (cx(p) + R) + ' ' + cy(p) + ' L' + (cx(c) - R) + ' ' + cy(c) : curve(cx(p) + R * .7, cy(p) + (cy(c) > cy(p) ? R * .7 : -R * .7), cx(c) - R, cy(c), false),
            class: 'gf-gedge' + (dim ? ' dim' : ''), style: { stroke: api.color(ramas[laneOf[c.rama]].serie || laneOf[c.rama] + 1) } });
          svg.appendChild(path);
        });
      });
      var nodeG = {};
      commits.forEach(function (c) {
        if (!st.vis[c.id]) return;
        var dim = !st.reach[c.id], hl = st.hl.indexOf(c.id) >= 0, col = api.color(ramas[laneOf[c.rama]].serie || laneOf[c.rama] + 1);
        var g = s('g', { class: 'gf-commit' + (dim ? ' dim' : '') + (hl ? ' now' : ''), transform: 'translate(' + cx(c) + ',' + cy(c) + ')' }, [
          s('circle', { r: R, class: 'gf-dot', style: { stroke: hl ? 'var(--hl)' : col } }),
          s('text', { y: 4.5, 'text-anchor': 'middle', class: 'gf-cid' }, c.id),
          c.mensaje ? s('text', { y: R + 17, 'text-anchor': 'middle', class: 'gf-msg' }, c.mensaje.length > 11 ? c.mensaje.slice(0, 10) + '…' : c.mensaje) : null,
          c.mensaje ? s('title', null, c.id + ': ' + c.mensaje) : null
        ]);
        svg.appendChild(g);
        nodeG[c.id] = g;
        if (c.step === n && n > 0 && ctx && ctx.animate) api.animate(g, [{ opacity: 0, transform: 'translate(' + cx(c) + 'px,' + (cy(c) - 10) + 'px)' }, { opacity: 1, transform: 'translate(' + cx(c) + 'px,' + cy(c) + 'px)' }], { duration: 420, delay: 120 }, ctx);
      });
      /* ref tags, stacked above their commit */
      var at = tagsAt(st), prevAt = prev ? tagsAt(prev) : null;
      Object.keys(at).forEach(function (id) {
        var c = byId[id];
        if (!c) return;
        at[id].forEach(function (t, k) {
          var label = t.detached ? 'HEAD' : (t.head ? 'HEAD → ' + t.ref : t.ref);
          var tw = label.length * 7.6 + 14, x = cx(c) - tw / 2, y = cy(c) - R - 10 - (k + 1) * 23;
          var serie = t.detached ? null : (ramas[laneOf[t.ref]] ? ramas[laneOf[t.ref]].serie || laneOf[t.ref] + 1 : null);
          var g = s('g', { class: 'gf-tag' + (t.head ? ' head' : ''), transform: 'translate(' + x + ',' + y + ')' }, [
            s('rect', { width: tw, height: 20, rx: 10, style: { fill: serie ? api.color(serie, true) : 'var(--surface)', stroke: serie ? api.color(serie) : 'var(--ink)' } }),
            s('text', { x: tw / 2, y: 14, 'text-anchor': 'middle' }, label)
          ]);
          svg.appendChild(g);
          if (prevAt) {
            var was = null;
            Object.keys(prevAt).forEach(function (pid) { prevAt[pid].forEach(function (pt) { if (pt.ref === t.ref) was = pid; }); });
            if (was && was !== id && byId[was]) {
              var dx = cx(byId[was]) - cx(c), dy = cy(byId[was]) - cy(c);
              api.animate(g, [{ transform: 'translate(' + (x + dx) + 'px,' + (y + dy) + 'px)' }, { transform: 'translate(' + x + 'px,' + y + 'px)' }], { duration: 520, delay: 250 }, ctx);
            }
          }
        });
      });
      api.caption(n === 0 ? (cfg.intro || 'Avanza para ver cada operación.') : (pasos[n - 1].texto || ''));
    }
    return { steps: pasos.length, setStep: setStep };
  }
})();
