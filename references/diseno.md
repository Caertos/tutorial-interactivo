# Diseño y construcción

Cómo se arma una presentación con el núcleo y los módulos visuales, y qué reglas visuales mantener. El contrato de los módulos (API de `Viz.register`, pasos, `meta.json`) está en `assets/viz/README.md`: no lo dupliques aquí, léelo solo si creas un visual ad hoc o un módulo.

## Índice
1. Principios
2. Estilo único y tokens
3. Colores de rol y de serie
4. Arquitectura: esqueleto, núcleo, módulos y build
5. Componentes del núcleo
6. Insertar un módulo visual
7. Visual ad hoc
8. Animación
9. Requisitos técnicos

---

## 1. Principios

- **El color es información.** Cada parámetro tiene un color y el resultado otro; cada tabla, capa o entidad tiene su color de serie. Se mantiene en todas las diapositivas para que la persona siga cada pieza sin releer. Nunca decora.
- **Revelado progresivo.** Cada «Siguiente» muestra una sola cosa nueva: un fragmento, una nota que ilumina su código o un paso de un módulo.
- **Visual con propósito.** Un visual existe porque explica una idea mejor que el texto. Elegirlo por vistoso produce ruido; por eso el «Plan visual» clasifica la forma de cada idea antes de elegir.
- **Interfaz silenciosa.** Fondo limpio, Bricolage Grotesque para texto y JetBrains Mono para código, sin tarjetas con sombra, sin etiquetas en mayúsculas.

## 2. Estilo único y tokens

Hay un solo estilo visual, con tema claro y oscuro. No construyas estilos alternativos. Todos los colores son tokens CSS definidos en `assets/core/engine.css` en tres bloques: claro (`:root`), oscuro por preferencia del sistema y `[data-theme="dark"]`. Un tema futuro sería otro bloque de tokens, sin tocar componentes ni módulos.

Reglas:
- Usa siempre tokens (`var(--a)`, `var(--s2-soft)`…), nunca hexadecimales sueltos: así el modo oscuro funciona solo.
- Superficies y texto: `--bg`, `--surface`, `--ink`, `--muted`, `--line`; código: `--code-bg`, `--code-ink`.
- No edites `engine.css` para un tutorial concreto. Estilos propios, en un `<style>` del deck y solo con tokens.

## 3. Colores de rol y de serie

| Rol | Token | Texto | Etiqueta | En código | Uso |
|---|---|---|---|---|---|
| 1.er parámetro | `--a` | `.pa` | `.tag.a` | `.fa` | azul |
| 2.º parámetro | `--b` | `.pb` | `.tag.b` | `.fb` | ámbar |
| 3.er parámetro | `--c` | `.pc` | `.tag.c` | `.fc` | turquesa |
| 4.º parámetro | `--d` | `.pd` | `.tag.d` | `.fd` | magenta |
| Resultado / válido | `--r` | `.pr` | `.tag.r` | `.fr` | verde |
| Error / inválido | `--err` | `.pe` | `.tag.e` | `.fe` | rojo |
| Serie 1…6 (tablas, capas, actores, ramas) | `--s1`…`--s6` | `.ps1`…`.ps6` | `.tag.s1`… | — | categóricos |
| Atención en este paso | `--hl` | — | — | `.code-hl` | resaltado |

Cada token tiene su variante `-soft` para fondos. Clases de código: `.k` palabra clave, `.s` cadena, `.c` comentario, `.fn` nombre de la unidad.

Reglas:
- Roles (`a`–`d`, `r`, `err`) para parámetros y resultado en modo `api`. Series (`s1`–`s6`) para entidades que no son parámetros: tablas de un JOIN, capas de un flujo, actores de una secuencia.
- Verde solo para el resultado y lo válido; rojo solo para lo inválido; `--hl` solo para «mira esto ahora».
- Más de 4 parámetros: los cuatro principales llevan color; el resto va en una tabla sin color de rol. Un objeto de opciones lleva un color entero; sus claves no.
- Asigna los colores en el guion y no los cambies entre diapositivas.
- Series en orden: a elementos vecinos (capas contiguas, tablas de un mismo JOIN) dales `s1`, `s2`, `s3`… seguidos. La paleta está comprobada para daltonismo entre series consecutivas, no entre cualquier par: `s1` (azul) y `s4` (violeta) se confunden si van juntas, y cada serie debe ir además con su nombre o etiqueta.

## 4. Arquitectura: esqueleto, núcleo, módulos y build

| Pieza | Ruta | Papel |
|---|---|---|
| Esqueleto | `assets/esqueleto.html` | Punto de partida del deck: barra superior, escenario, navegación y los marcadores `<!-- @@ESTILOS@@ -->` y `<!-- @@SCRIPTS@@ -->` (no los borres). |
| Núcleo | `assets/core/engine.css`, `assets/core/engine.js` | Tokens, layout, navegación, fragmentos, quiz, tema y registro de módulos. No se edita por tutorial. |
| Componentes | `assets/core/componentes/*.html` | Fragmentos HTML del núcleo para copiar (sección 5). |
| Módulos | `assets/viz/<nombre>/` | Visualizaciones configurables por JSON. Índice en `references/catalogo.md`. |
| Build | `scripts/build.py` | Inserta el núcleo y solo los módulos usados; produce un único HTML autocontenido. |
| Validación | `scripts/validate.py` | Comprueba configuraciones, módulos, `aria-label`, recursos remotos y etiquetas; toma capturas. |

Estructura del deck:
- `<section class="slide" aria-label="…">` por diapositiva; el `aria-label` nombra su punto de navegación. `.slide.center` centra en vertical (portada).
- Contenido en `<div class="wrap">`. Actualiza `<title>`, la barra («Documentación de …») y el texto de portada.
- `.frag`: aparece con cada «Siguiente». `data-hl="x"` en un `.frag` ilumina los `data-tok="x"` de la diapositiva.
- `data-restart` vuelve al inicio; `data-theme-toggle` alterna el tema.
- Lógica propia (por ejemplo un playground) en el `<script>` final del esqueleto; ejemplo en `assets/core/ejemplos/playground-sum.js`.

Navegación ya implementada: flechas, espacio, Re Pág/Av Pág, Inicio/Fin, deslizar, puntos y botones. Parámetros de URL para revisar: `?slide=N` (desde 1), `?pasos=todos` (todos los pasos visibles), `?paso=K` (los K primeros pasos), `?theme=dark|light`.

## 5. Componentes del núcleo

Lista con su «cuándo» en `references/catalogo.md`. Copia el fragmento del archivo y sustituye el contenido; conserva clases y atributos.

Notas que no están en los archivos:
- **Portada** (`01-portada.html`): la firma `.sig` se ajusta sola al ancho (el núcleo calcula el tamaño por número de letras y lo reduce si aún desborda); no le pongas tamaño propio. Por encima de ~24 caracteres queda pequeña en el móvil: abrevia los parámetros (`fetch(url, opciones)` → `fetch(url, …)`). En modos `datos`, `flujo` y `concepto` la portada lleva el título de la idea, no una firma.
- **Ficha de parámetro**: chips `.chip.ok` (válidos) y `.chip.no` (inválidos) con `style="--i:n"` para el orden escalonado.
- **Predice el resultado** (`06-quiz.html`): 2 a 4 por diapositiva, de menos a más difícil; cada opción incorrecta con `data-why` que explique ese error. Respuestas siempre de ejecuciones reales.
- **Playground**: solo si reproduces fielmente la semántica en el navegador. Si no, usa el quiz. Un playground que simula mal es peor que no tenerlo.
- **Escapa** `<`, `>` y `&` dentro del código mostrado (`=&gt;`, `&lt;T&gt;`).

## 6. Insertar un módulo visual

```html
<div class="viz" data-viz="join" aria-label="Qué muestra, en una frase">
  <script type="application/json">{ "tipo": "LEFT", "...": "..." }</script>
</div>
```

- Antes de configurarlo, lee `assets/viz/<nombre>/meta.json` (todas las opciones) y `demo.html` (un ejemplo real). Nada más del módulo.
- La configuración va en el primer `<script type="application/json">` hijo: JSON válido, sin comentarios.
- Dentro del JSON escribe todo `</` como `<\/` (`"<\/h1>"`): un `</script` literal cierra la etiqueta antes de tiempo y el resto de la configuración aparece como texto en la página. `JSON.parse` lo lee como `</`, así que el módulo muestra `</h1>`. `validate.py` detecta la configuración cortada y lo indica.
- `aria-label` es obligatorio.
- Los pasos del módulo se recorren con el «Siguiente» de la diapositiva, intercalados con los `.frag` en orden del documento. Coloca el texto explicativo como `.frag` antes o después según el orden en que deba aparecer.
- Texto con color en la configuración: segmentos `[["texto", "rol"]]` con roles `a b c d r e`, `k s com fn hl` o series `1`–`6`.
- Un error de configuración se ve como un aviso rojo dentro del módulo: revisa las capturas.

## 7. Visual ad hoc

Solo si ningún módulo del catálogo sirve para la forma de la idea. Reglas:
- Usa únicamente tokens del núcleo y las clases existentes; nada de colores sueltos ni librerías externas.
- Si necesita pasos o animación, regístralo con `Viz.register` en el `<script>` del deck siguiendo `assets/viz/README.md` (secciones 3 a 5 y 7): prefijo propio de clases, `setStep` idempotente, `api.reduced`, ancho de 360 px.
- Si es estático, HTML con clases del núcleo (`.tablewrap`, `.tag`, `.callout`…) o un SVG con `viewBox` dentro de `.viz-scroll`.
- Anota en la ficha por qué ningún módulo servía.

## 8. Animación

- Automáticas permitidas: firma tecleada en portada, chips escalonados y la entrada de un módulo sin pasos. Nada más se mueve sin que la persona lo pida.
- De respuesta: revelado de fragmentos, iluminado de código, pasos de módulos, respuesta del quiz.
- Ir hacia atrás nunca anima. Cada módulo tiene su botón «Repetir».
- `prefers-reduced-motion` muestra el estado final sin transiciones; no lo desactives en estilos propios.

## 9. Requisitos técnicos

- Un único HTML autocontenido producido por `scripts/build.py`. Solo Google Fonts es remoto; sin scripts, imágenes ni estilos externos (el validador falla si los hay).
- El cuerpo nunca hace scroll horizontal a 360–390 px: código, tablas y SVG anchos tienen su propio scroll.
- Foco visible en botones e inputs; textos de 12 px como mínimo en SVG.
- Puntuación tipográfica en el texto visible (« » y ’ en español; “ ” en inglés); comillas rectas solo en código y atributos.
- Comentarios de código en el idioma del proyecto; si no hay proyecto, en inglés.
