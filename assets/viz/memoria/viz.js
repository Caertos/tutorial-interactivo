/* viz: memoria — call stack frames with variables and a heap of objects; references are arrows.
   Steps apply operations (create objects, set variables, mutate fields, call/return, collect).
   Objects that no variable can reach (directly or through other objects) are marked as garbage
   automatically until a step with "recolectar" removes them. */
Viz.register('memoria', {
  render: function (el, cfg, api) {
    var h = api.el, s = api.svg;
    var pasos = cfg.pasos || [];
    var isRef = function (v) { return v && typeof v === 'object' && !Array.isArray(v) && 'ref' in v; };

    function state(n) {
      var frames = (cfg.marcos || [{ nombre: 'global' }]).map(function (f) { return { nombre: f.nombre, vars: [], vals: {} }; });
      var heap = [], byId = {}, chg = {}, born = {};
      function setVar(f, k, v) { if (!(k in f.vals)) f.vars.push(k); f.vals[k] = v; }
      for (var i = 0; i < n; i++) {
        var p = pasos[i], last = i === n - 1;
        if (p.llamar) frames.push({ nombre: String(p.llamar), vars: [], vals: {} });
        (p.crear || []).forEach(function (o) {
          if (byId[o.id]) throw new Error('El objeto «' + o.id + '» ya existe.');
          var arr = Array.isArray(o.elementos);
          var obj = { id: String(o.id), tipo: o.tipo || (arr ? 'Array' : 'Object'), arr: arr, keys: [], vals: {} };
          if (arr) o.elementos.forEach(function (v, j) { obj.keys.push(String(j)); obj.vals[j] = v; });
          else Object.keys(o.campos || {}).forEach(function (k) { obj.keys.push(k); obj.vals[k] = o.campos[k]; });
          heap.push(obj); byId[obj.id] = obj;
          if (last) born[obj.id] = 1;
        });
        var top = frames[frames.length - 1];
        Object.keys(p.vars || {}).forEach(function (k) {
          var f = top, name = k;
          if (k.indexOf('.') > 0) { var fn = k.slice(0, k.indexOf('.')); name = k.slice(k.indexOf('.') + 1); f = frames.find(function (x) { return x.nombre === fn; }) || top; }
          setVar(f, name, p.vars[k]);
          if (last) chg['v:' + f.nombre + ':' + name] = 1;
        });
        (p.mutar || []).forEach(function (m) {
          var o = byId[m.id];
          if (!o) throw new Error('mutar: el objeto «' + m.id + '» no existe.');
          var k = String(m.campo);
          if (!(k in o.vals)) o.keys.push(k);
          o.vals[k] = m.valor;
          if (last) chg['o:' + o.id + ':' + k] = 1;
        });
        if (p.volver && frames.length > 1) frames.pop();
        if (p.recolectar) {
          var r = reach(frames, byId);
          heap = heap.filter(function (o) { if (!r[o.id]) { delete byId[o.id]; return false; } return true; });
        }
      }
      return { frames: frames, heap: heap, byId: byId, chg: chg, born: born, reach: reach(frames, byId) };
    }
    function reach(frames, byId) {
      var seen = {}, st = [];
      frames.forEach(function (f) { f.vars.forEach(function (k) { if (isRef(f.vals[k])) st.push(f.vals[k].ref); }); });
      while (st.length) {
        var id = st.pop();
        if (seen[id] || !byId[id]) continue;
        seen[id] = 1;
        byId[id].keys.forEach(function (k) { var v = byId[id].vals[k]; if (isRef(v)) st.push(v.ref); });
      }
      return seen;
    }

    /* ---------- DOM ---------- */
    var codeLines = [], lineOf = [];
    pasos.forEach(function (p, i) {
      if (p.codigo != null) String(p.codigo).split('\n').forEach(function (l) { codeLines.push(l); lineOf.push(i); });
    });
    var lineEls = codeLines.map(function (l, i) { return h('span', { class: 'me-ln' }, [h('span', { class: 'me-ln-n', 'aria-hidden': 'true' }, String(i + 1)), l || ' ']); });
    var code = codeLines.length ? h('div', { class: 'viz-code me-code' }, [
      h('div', { class: 'viz-code-head' }, [h('span', { class: 'viz-code-title' }, cfg.tituloCodigo || 'Código'), h('span', { class: 'viz-code-lang' }, cfg.lang || 'js')]),
      h('pre', { class: 'code' }, h('code', null, lineEls))
    ]) : null;
    var stackCol = h('div', { class: 'me-col me-stack' });
    var heapCol = h('div', { class: 'me-col me-heap' });
    var arrows = s('svg', { class: 'me-arrows', 'aria-hidden': 'true' });
    var board = h('div', { class: 'me-board' }, [
      h('p', { class: 'me-h' }, cfg.tituloPila || 'Pila'), h('span'), h('p', { class: 'me-h' }, cfg.tituloHeap || 'Montículo (heap)'),
      stackCol, h('span', { class: 'me-gap' }), heapCol, arrows
    ]);
    el.appendChild(h('div', { class: 'me' }, [code, h('div', { class: 'viz-scroll' }, board)]));

    var cur = 0, links = [];
    function valNode(v, key) {
      if (isRef(v)) { var d = h('span', { class: 'me-ref', 'data-ref': v.ref, 'aria-label': 'referencia a ' + v.ref }); links.push({ from: d, to: v.ref, key: key }); return d; }
      return h('span', { class: 'me-prim' }, v === null ? 'null' : (v === undefined ? 'undefined' : (typeof v === 'string' ? '"' + v + '"' : String(v))));
    }

    function draw(n, ctx) {
      var st = state(n);
      links = [];
      stackCol.textContent = ''; heapCol.textContent = '';
      st.frames.slice().reverse().forEach(function (f, fi) {
        var rows = f.vars.map(function (k) {
          var key = 'v:' + f.nombre + ':' + k;
          return h('div', { class: 'me-row' + (st.chg[key] ? ' chg' : '') }, [h('span', { class: 'me-k' }, k), valNode(f.vals[k], key)]);
        });
        stackCol.appendChild(h('section', { class: 'me-frame' + (fi === 0 ? ' me-cur' : '') }, [h('p', { class: 'me-fn' }, f.nombre),
          rows.length ? rows : h('p', { class: 'me-empty' }, 'sin variables')]));
      });
      var objEls = {};
      st.heap.forEach(function (o) {
        var garbage = !st.reach[o.id];
        var rows = o.keys.map(function (k) {
          var key = 'o:' + o.id + ':' + k;
          return h('div', { class: 'me-row' + (st.chg[key] ? ' chg' : '') }, [h('span', { class: 'me-k' }, o.arr ? '[' + k + ']' : k), valNode(o.vals[k], key)]);
        });
        var card = h('section', { class: 'me-obj' + (garbage ? ' garbage' : '') + (st.born[o.id] ? ' born' : ''), 'data-id': o.id }, [
          h('p', { class: 'me-oh' }, [h('span', null, o.tipo), h('span', { class: 'me-oid' }, '#' + o.id)]),
          rows.length ? rows : h('p', { class: 'me-empty' }, o.arr ? '[]' : '{}'),
          garbage ? h('p', { class: 'me-gc' }, 'sin referencias: basura') : null
        ]);
        objEls[o.id] = card;
        heapCol.appendChild(card);
        if (st.born[o.id] && ctx && ctx.animate) api.animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 }, ctx);
      });
      if (!st.heap.length) heapCol.appendChild(h('p', { class: 'me-empty' }, 'vacío'));
      drawArrows(objEls, st, ctx);
      lineEls.forEach(function (l, i) { l.classList.toggle('now', n > 0 && lineOf[i] === n - 1); l.classList.toggle('done', n > 0 && lineOf[i] < n - 1); });
    }

    var lastObjEls = {}, lastSt = null;
    function drawArrows(objEls, st, ctx) {
      lastObjEls = objEls; lastSt = st;
      arrows.textContent = ''; arrows._markers = null;
      var br = board.getBoundingClientRect();
      if (!br.width) return;
      arrows.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
      arrows.setAttribute('width', br.width); arrows.setAttribute('height', br.height);
      links.forEach(function (lk) {
        var target = objEls[lk.to];
        if (!target) return;
        var a = lk.from.getBoundingClientRect(), t = target.getBoundingClientRect();
        var x1 = a.left - br.left + a.width / 2, y1 = a.top - br.top + a.height / 2;
        var inHeap = !!lk.from.closest('.me-heap');
        var now = !!st.chg[lk.key];
        var garbage = !st.reach[lk.to];
        var d, x2, y2;
        if (!inHeap) {
          x2 = t.left - br.left - 2; y2 = t.top - br.top + 16;
          var mx = (x1 + x2) / 2;
          d = 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2;
        } else {
          x2 = t.right - br.left + 2; y2 = t.top - br.top + 16;
          var ox = Math.max(x1, x2) + 34;
          d = 'M' + x1 + ' ' + y1 + ' C' + ox + ' ' + y1 + ' ' + ox + ' ' + y2 + ' ' + x2 + ' ' + y2;
        }
        var col = now ? 'var(--hl)' : (garbage ? 'var(--muted)' : 'var(--ink)');
        var p = s('path', { d: d, class: 'me-arrow' + (now ? ' now' : ''), style: { stroke: col }, 'marker-end': api.marker(arrows, col) });
        arrows.appendChild(p);
        arrows.appendChild(s('circle', { cx: x1, cy: y1, r: 3.5, style: { fill: col } }));
        if (now && ctx && ctx.animate && p.getTotalLength) {
          var L = p.getTotalLength();
          p.style.strokeDasharray = L + ' ' + L;
          api.animate(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 500, delay: 150 }, ctx);
        }
      });
    }

    function setStep(n, ctx) {
      cur = Math.max(0, Math.min(n, pasos.length));
      draw(cur, ctx);
      api.caption(cur === 0 ? (cfg.intro || 'Avanza para ejecutar el código línea a línea.') : (pasos[cur - 1].texto || ''));
    }
    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (lastSt) drawArrows(lastObjEls, lastSt, null); }) : null;
    if (ro) ro.observe(board);
    return { steps: pasos.length, setStep: setStep, destroy: function () { if (ro) ro.disconnect(); el.textContent = ''; } };
  }
});
