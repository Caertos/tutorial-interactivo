/* Example playground logic for [data-playground="sum"] (see core/componentes/08-playground.html).
   Copy into the deck's own <script> and replace parse()/calc() with the real semantics of the unit. */
(function () {
  'use strict';
  function parse(raw) {
    var t = raw.trim();
    if (t === '') return undefined;
    if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return Number(t);
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (t === 'undefined') return undefined;
    var q = t.match(/^(["'])(.*)\1$/);
    if (q) return q[2];
    return t;
  }
  function show(v) { return typeof v === 'string' ? '"' + v + '"' : String(v); }
  function kind(v) { return v === null ? 'null' : typeof v; }

  document.querySelectorAll('[data-playground="sum"]').forEach(function (root) {
    var inA = root.querySelector('[data-in="a"]'), inB = root.querySelector('[data-in="b"]');
    var box = root.querySelector('[data-out]'), val = root.querySelector('[data-val]'), msg = root.querySelector('[data-msg]');
    function calc() {
      var a = parse(inA.value), b = parse(inB.value);
      var r = a + b;
      val.textContent = show(r);
      val.classList.remove('flash'); void val.offsetWidth; val.classList.add('flash');
      var ok = typeof a === 'number' && typeof b === 'number';
      box.classList.toggle('ok', ok); box.classList.toggle('bad', !ok);
      if (ok) {
        msg.textContent = (Math.abs(r - Number(r.toFixed(10))) > 0)
          ? 'Uso correcto. El resultado tiene un error de redondeo binario: redondéalo al mostrarlo.'
          : 'Uso correcto: los dos son números y el resultado es un number.';
      } else if (typeof a === 'string' || typeof b === 'string') {
        msg.textContent = 'Uso incorrecto: hay un texto, así que + pegó los valores en lugar de sumarlos. Convierte con Number() antes.';
      } else if (a === undefined || b === undefined) {
        msg.textContent = 'Uso incorrecto: falta un argumento, vale undefined y la suma da NaN.';
      } else {
        msg.textContent = 'Uso incorrecto: recibió ' + kind(a) + ' y ' + kind(b) + '. JavaScript los convirtió a número sin avisar; el resultado no es fiable.';
      }
    }
    inA.addEventListener('input', calc);
    inB.addEventListener('input', calc);
    root.querySelectorAll('.presets .btn').forEach(function (b) {
      b.addEventListener('click', function () { inA.value = b.dataset.a; inB.value = b.dataset.b; calc(); });
    });
    calc();
  });
})();
