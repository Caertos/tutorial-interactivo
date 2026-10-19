/* viz: arbol — tree (DOM, AST, file tree, index) with a tidy top-down layout computed here.
   Steps mark the current node, accumulate visited nodes (numbered in visit order), highlight a
   path, mark matches and fold/unfold subtrees. "recorrido" generates the steps automatically. */
Viz.register('arbol', {
  render: function (el, cfg, api) {
    var s = api.svg;
    if (!cfg.raiz) throw new Error('«arbol» necesita "raiz": { "etiqueta": "body", "hijos": [ … ] }.');
    var all = [], byId = {};
    (function walk(n, parent, path) {
      var node = { id: n.id != null ? String(n.id) : path, etiqueta: String(n.etiqueta == null ? '' : n.etiqueta), detalle: n.detalle != null ? String(n.detalle) : null,
        serie: n.serie, parent: parent, hijos: [], plegado: !!n.plegado };
      all.push(node); byId[node.id] = node;
      if (parent) parent.hijos.push(node);
      (n.hijos || []).forEach(function (c, i) { walk(c, node, path + '.' + i); });
    })(cfg.raiz, null, 'n');
    var root = all[0];
    function ref(x) {
      if (x == null) return null;
      x = String(x);
      if (byId[x]) return byId[x];
      for (var i = 0; i < all.length; i++) if (all[i].etiqueta === x) return all[i];
      throw new Error('El árbol no tiene un nodo con id o etiqueta «' + x + '».');
    }
    function refs(list) { return (list || []).map(ref); }

    /* steps: explicit or generated from a traversal */
    var pasos = cfg.pasos;
    if (!pasos && cfg.recorrido) {
      var order = [];
      if (cfg.recorrido === 'anchura') {
        var q = [root];
        while (q.length) { var x = q.shift(); order.push(x); q = q.concat(x.hijos); }
      } else (function rec(n) {
        if (cfg.recorrido !== 'postorden') order.push(n);
        n.hijos.forEach(rec);
        if (cfg.recorrido === 'postorden') order.push(n);
      })(root);
      pasos = order.map(function (n, i) { return { actual: n.id, texto: 'Visita ' + (i + 1) + ': ' + n.etiqueta + '.' }; });
    }
    pasos = (pasos || []).map(function (p) {
      return { actual: ref(p.actual), visitar: refs(p.visitar), camino: refs(p.camino), encontrado: refs(p.encontrado),
        plegar: refs(p.plegar), desplegar: refs(p.desplegar), texto: p.texto || '' };
    });
    var numerar = cfg.numerar !== false;

    var hasDet = all.some(function (n) { return n.detalle; });
    var NH = hasDet ? 44 : 32, LEVEL = NH + 38, GAP = 14, PAD = 12;
    function nodeW(n) { return Math.max(44, Math.max(n.etiqueta.length * 8.1, (n.detalle || '').length * 6.8) + 22); }

    var box = api.svgBox(300, 100, { minScale: 0.85, maxScale: 1.2, label: api.root.getAttribute('aria-label') || 'Árbol', clase: 'ar' });
    el.appendChild(box.wrap);
    var svg = box.svg;

    function state(n) {
      var st = { plegados: {}, visit: {}, order: 0, found: {}, cur: null, camino: [] };
      all.forEach(function (x) { if (x.plegado) st.plegados[x.id] = 1; });
      for (var i = 0; i < n; i++) {
        var p = pasos[i];
        p.plegar.forEach(function (x) { st.plegados[x.id] = 1; });
        p.desplegar.forEach(function (x) { delete st.plegados[x.id]; });
        (p.actual ? [p.actual] : []).concat(p.visitar).forEach(function (x) { if (!(x.id in st.visit)) st.visit[x.id] = ++st.order; });
        p.encontrado.forEach(function (x) { st.found[x.id] = 1; });
      }
      if (n > 0) { st.cur = pasos[n - 1].actual; st.camino = pasos[n - 1].camino; }
      return st;
    }

    function layout(st) {
      var pos = {};
      function kids(n) { return st.plegados[n.id] ? [] : n.hijos; }
      function width(n) {
        var ks = kids(n);
        var cw = ks.reduce(function (a, k) { return a + width(k); }, 0) + Math.max(0, ks.length - 1) * GAP;
        n._w = Math.max(nodeW(n), cw);
        return n._w;
      }
      function place(n, left, depth) {
        var ks = kids(n);
        pos[n.id] = { x: left + n._w / 2, y: PAD + 14 + depth * LEVEL, w: nodeW(n) };
        var cw = ks.reduce(function (a, k) { return a + k._w; }, 0) + Math.max(0, ks.length - 1) * GAP;
        var x = left + (n._w - cw) / 2;
        ks.forEach(function (k) { place(k, x, depth + 1); x += k._w + GAP; });
        if (ks.length) pos[n.id].x = (pos[ks[0].id].x + pos[ks[ks.length - 1].id].x) / 2;
      }
      var W = width(root) + PAD * 2;
      place(root, PAD, 0);
      var maxY = 0;
      Object.keys(pos).forEach(function (k) { maxY = Math.max(maxY, pos[k].y); });
      return { pos: pos, W: Math.max(W, 120), H: maxY + NH + PAD + 4 };
    }

    function draw(n, ctx) {
      var st = state(n), L = layout(st), pos = L.pos;
      box.size(L.W, L.H);
      svg.textContent = '';
      var onPath = {};
      st.camino.forEach(function (x) { onPath[x.id] = 1; });
      all.forEach(function (c) {
        if (!c.parent || !pos[c.id] || !pos[c.parent.id]) return;
        var a = pos[c.parent.id], b = pos[c.id], my = (a.y + NH + b.y) / 2;
        var hl = onPath[c.id] && onPath[c.parent.id];
        svg.appendChild(s('path', { d: 'M' + a.x + ' ' + (a.y + NH) + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + b.y,
          class: 'ar-edge' + (hl ? ' path' : '') + (st.visit[c.id] ? ' seen' : '') }));
      });
      var curG = null;
      all.forEach(function (x) {
        var p = pos[x.id];
        if (!p) return;
        var cls = 'ar-node' + (st.visit[x.id] ? ' seen' : '') + (onPath[x.id] ? ' path' : '') + (st.found[x.id] ? ' found' : '') + (st.cur === x ? ' now' : '');
        var g = s('g', { class: cls, transform: 'translate(' + (p.x - p.w / 2) + ',' + p.y + ')' });
        g.appendChild(s('rect', { width: p.w, height: NH, rx: 8, class: 'ar-box', style: x.serie && !st.visit[x.id] ? { stroke: api.color(x.serie) } : null }));
        g.appendChild(s('text', { x: p.w / 2, y: x.detalle ? 18 : NH / 2 + 5, 'text-anchor': 'middle', class: 'ar-lbl' }, x.etiqueta));
        if (x.detalle) g.appendChild(s('text', { x: p.w / 2, y: 35, 'text-anchor': 'middle', class: 'ar-det' }, x.detalle));
        if (st.plegados[x.id] && x.hijos.length) {
          g.appendChild(s('text', { x: p.w / 2, y: NH + 15, 'text-anchor': 'middle', class: 'ar-fold' }, '+' + count(x) + ' ocultos'));
        }
        if (numerar && st.visit[x.id]) {
          g.appendChild(s('circle', { cx: p.w, cy: 0, r: 9, class: 'ar-ord' }));
          g.appendChild(s('text', { x: p.w, y: 4, 'text-anchor': 'middle', class: 'ar-ord-t' }, String(st.visit[x.id])));
        }
        svg.appendChild(g);
        if (st.cur === x) curG = g;
      });
      if (curG && ctx && ctx.animate) api.animate(curG.querySelector('rect'), [{ opacity: 0.2 }, { opacity: 1 }], { duration: 380 }, ctx);
    }
    function count(n) { return n.hijos.reduce(function (a, k) { return a + 1 + count(k); }, 0); }

    function setStep(n, ctx) {
      n = Math.max(0, Math.min(n, pasos.length));
      draw(n, ctx);
      api.caption(n === 0 ? (cfg.intro || 'Avanza para recorrer el árbol.') : pasos[n - 1].texto);
    }
    return { steps: pasos.length, setStep: setStep };
  }
});
