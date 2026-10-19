---
name: tutorial-interactivo
description: Genera una presentación HTML didáctica, animada e interactiva que enseña una API (función, método, clase, hook, componente, comando, endpoint u opción de configuración), un tema de datos (tablas, JOIN, GROUP BY, índices, cómo se ejecuta una consulta, esquemas), un flujo entre capas de un sistema (cliente, API, servicio, base de datos y vuelta; protocolos) o un concepto técnico (bucle de eventos, referencias frente a valores, máquinas de estados, internos de git, algoritmos). Explora el proyecto, su stack y su esquema, pregunta solo lo que cambia el resultado, verifica cada dato ejecutándolo y elige visualizaciones por la forma de cada idea. Úsala siempre que pidan una guía, tutorial, lección, clase, diagrama o explicación, como «enséñame / explícame cómo usar X», «cómo funciona X», «cómo funciona por dentro X», «qué hace este método», «para qué sirve este parámetro», «explícame cómo funciona un JOIN», «cómo viaja una petición hasta la base de datos», «qué pasa cuando…» o «diagrama de…», aunque no mencione presentación ni HTML. También en inglés: «teach me how to use X», «tutorial for X», «walk me through this API», «explain this function», «explain how a JOIN works», «how does a request reach the database», «how does X work under the hood», «what happens when…», «diagram of…».
---

# Tutorial interactivo

Convierte una pieza técnica en una presentación HTML que deja a la persona entendiéndola y sabiendo usarla. Resultado: un único HTML autocontenido con diapositivas, navegación (teclado, deslizar, botones), revelado paso a paso, visualizaciones configurables, tema claro y oscuro.

## Archivos

`<skill>` es el directorio de esta skill.

| Archivo | Cuándo leerlo |
|---|---|
| `references/investigacion.md` | Pasos 1, 3 y 4: detectar stack, dialecto SQL, trazar flujos, verificar, plantilla de ficha. |
| `references/pedagogia.md` | Pasos 5 a 7: ejemplo, profundidad, secuencia por modo, plan visual. |
| `references/catalogo.md` | Paso 7: índice de módulos y componentes. Generado; léelo **en lugar de** `assets/biblioteca.html` (galería para personas, ~340 KB: nunca la leas). |
| `references/diseno.md` | Paso 8: tokens, colores, componentes, cómo insertar un módulo, animación. |
| `assets/viz/<nombre>/meta.json`, `demo.html` | Paso 8, solo para los módulos elegidos. |
| `assets/viz/README.md` | Solo si haces un visual ad hoc o un módulo nuevo. |

## Flujo de trabajo

Sigue los pasos en orden: cada uno produce lo que el siguiente necesita. Saltar al HTML sin ficha es la causa principal de tutoriales con datos inventados.

### Paso 0. Entender la petición y elegir el modo

Identifica la unidad o idea concreta, el caso real de la persona (para elegir pieza y ejemplo), su nivel y su idioma (la presentación va en su idioma). Si pide algo amplio («enséñame React»), redúcelo a la pieza que más necesita y dilo.

Elige el modo; cada uno tiene su secuencia en `pedagogia.md`:

| Modo | Para |
|---|---|
| `api` | Función, método, clase, hook, componente, comando, endpoint, opción de configuración. |
| `datos` | Tablas, JOIN, GROUP BY, índices, ejecución de consultas, esquemas, transformaciones de datos. |
| `flujo` | Cómo viaja un dato o una petición por las capas de un sistema y vuelve; protocolos. |
| `concepto` | Bucle de eventos, referencias frente a valores, máquinas de estados, internos de git, algoritmos… |

### Paso 1. Explorar antes de preguntar

Todo lo que se pueda deducir no se pregunta. Busca la raíz (`git rev-parse --show-toplevel`) y extrae, según `investigacion.md`:

- Lenguaje, framework y **versión exacta** de la librería (lockfile), sistema de módulos y convenciones.
- Modo `datos`: dialecto y esquema (Prisma, migraciones, `docker-compose`, ORM, prefijo de la cadena de conexión; nunca leas secretos).
- Modo `flujo` sobre su app: la ruta real del dato (CodeGraph si existe `.codegraph/`; si no, ruta → controlador → servicio → repositorio).
- Si la unidad ya se usa en el proyecto y cómo (para corregir malos usos, no para copiar).

Sin proyecto: stack de la petición y última versión estable; dilo en la portada.

### Paso 2. Preguntar lo que cambia el resultado

Haz **una ronda inicial** de preguntas de opción múltiple, agrupadas, solo sobre lo que cambia el resultado y no se puede deducir. Candidatas:

- Modo, si es ambiguo.
- Ejemplo análogo o su caso real (ver regla del paso 5).
- Nivel o profundidad: básico, intermedio, avanzado.
- Dialecto o stack, si hay varios candidatos.
- Énfasis visual (p. ej. más paso a paso o más panorámico).

Cada pregunta lleva la opción recomendada primero, marcada como recomendada. Usa la herramienta de preguntas del entorno (`question` en opencode, `AskUserQuestion` en Claude Code); si no hay, pregunta en texto con opciones numeradas y **detente hasta recibir respuesta**.

Más adelante puedes volver a preguntar cuando aparezca algo nuevo que cambie el resultado y no se pueda deducir ni verificar: el esquema contradice la petición, hay dos flujos posibles, la versión instalada no es la que la persona cree, un resultado verificado cambia el enfoque. Agrupa esas preguntas cuando puedas, con la recomendada primero. Los detalles menores los decides tú y los anotas como suposiciones en la portada. Registra cada pregunta y respuesta en la ficha.

### Paso 3. Investigar y verificar

Sigue `investigacion.md`, secciones 4 y 5:

1. Referencia oficial de la versión detectada, leída completa con `web_fetch`; tipos o docstrings locales si hay proyecto; una fuente más (changelog, guía de migración).
2. **Verifica ejecutando** todo resultado que vayas a mostrar: SQL con `sqlite3` (o `duckdb`/`psql` si el dialecto lo exige y están disponibles), JS con `node -e`, git en un repositorio desechable en un directorio temporal. Guarda consultas, código y salidas en la carpeta de trabajo (`datos.sql`, ficha).

No rellenes huecos de memoria: lo que no puedas confirmar se marca «no confirmado» y no se presenta como hecho.

### Paso 4. Redactar la ficha

Crea la carpeta de trabajo `tutors/<unidad>/` y escribe `ficha.md` con la plantilla de `investigacion.md`: datos técnicos, preguntas y respuestas, suposiciones, traza del flujo si aplica y «Dataset y resultados reales». Toda afirmación de la presentación se rastrea hasta una línea de la ficha.

### Paso 5. Elegir el ejemplo

- **Por defecto, ejemplo análogo** al enseñar una herramienta, API o concepto: misma mecánica en un dominio simple y universal (quiere filtrar pedidos pendientes con `filter` → días de más de 25 °C). Termina con «Llévalo a tu caso».
- **Excepción: el tema es su sistema** («cómo viaja X en mi app», «explícame mi query»). Usa su código trazado y su esquema y forma de datos reales; nunca inventes capas, tablas ni campos. Termina con «Dónde está en tu código».

Escribe el ejemplo en el stack y dialecto detectados. Criterios y ejemplos en `pedagogia.md`.

### Paso 6. Planificar las diapositivas

Toma la secuencia del modo en `pedagogia.md` y adáptala. Escribe el guion: título de cada diapositiva y la única idea que transmite. Extensión según nivel: básico 8–12, intermedio 10–14, avanzado hasta 16; si necesitas más, divide en varias presentaciones.

Asigna colores: roles `a`–`d` a los parámetros y `r` al resultado; series `s1`–`s6` a tablas, capas o actores (`diseno.md`, sección 3). No cambian entre diapositivas.

### Paso 7. Plan visual

Lee `references/catalogo.md`. Para cada diapositiva: clasifica la forma de su idea con el vocabulario «Forma» del catálogo, elige el recurso que coincide y lee su «Cuándo no». Elige el mínimo que explica; los módulos son opcionales y no hay cuota: cada diapositiva lleva un visual o una línea que diga por qué no. Si ninguno sirve, visual ad hoc solo con tokens y motor del núcleo (`diseno.md`, sección 7). Nunca elijas por vistoso. Si la persona nombró un módulo, úsalo donde encaje. Anota la tabla del plan en la ficha (formato en `pedagogia.md`, sección 5).

### Paso 8. Construir

1. Lee `references/diseno.md` y, de cada módulo elegido, solo su `meta.json` y `demo.html`.
2. Lee `<skill>/assets/esqueleto.html` y escribe su contenido en `tutors/<unidad>/fuente.html` con la herramienta de escritura (o cópialo con `cp` y **léelo** antes de editarlo: las herramientas de edición rechazan archivos que no han leído).
3. Escribe una `<section class="slide" aria-label="…">` por diapositiva con componentes del núcleo (`assets/core/componentes/`) y módulos `<div class="viz" data-viz="<nombre>" aria-label="…">` con su JSON en `<script type="application/json">`. Conserva los marcadores `@@ESTILOS@@` y `@@SCRIPTS@@`. Actualiza título, barra superior y portada.
4. Playground solo si reproduces fielmente la semántica en el navegador; si no, quiz «Predice el resultado» con salidas reales del paso 3.
5. Compila: `python3 <skill>/scripts/build.py tutors/<unidad>/fuente.html -o tutors/<unidad>.html` (`--list` muestra los módulos disponibles).

### Paso 9. Verificar

1. `python3 <skill>/scripts/validate.py tutors/<unidad>.html --screenshots tutors/<unidad>/capturas --slides --pasos`. Debe terminar en `RESULT: OK`. `--slides` captura el estado final de cada diapositiva; `--pasos`, cada paso intermedio (`--slide N` limita ambos a una diapositiva, útil al corregir).
2. **Mira las PNG**, no te fíes solo del OK: portada en móvil y escritorio, claro y oscuro (`*-mobile-light.png`, `*-desktop-dark.png`…), el estado final de cada diapositiva (`*-sNN-mobile.png`, `*-sNN-desktop.png`) y sus pasos intermedios (`*-sNN-pKK-mobile.png`, paso K). Busca texto cortado, scroll horizontal, avisos rojos de configuración, solapes, contraste pobre y pasos que no muestran lo que su leyenda dice. Corrige, recompila y vuelve a validar.
3. Para revisar a mano: `?slide=N`, `?pasos=todos`, `?paso=K`, `?theme=dark` en la URL.
4. Comprueba además: cada dato coincide con la ficha; el código es válido para la versión detectada; el ejemplo sigue la regla del paso 5; colores coherentes; « » y ’ en el texto visible, comillas rectas solo en código.

### Paso 10. Entregar

- **En un proyecto**: `tutors/<unidad>.html` en la raíz del repositorio; añade `tutors/` al `.gitignore` si falta. No hagas commit ni push.
- **Sin proyecto**: `tutors/<unidad>.html` en el directorio actual, o donde indique la persona.

Da la ruta absoluta y ofrece abrirlo (`xdg-open <ruta>` en Linux, `open` en macOS). Mensaje breve: qué cubre y con qué versión o motor, qué ejemplo usaste y por qué, suposiciones y fuentes principales. Menciona que puede abrir `<skill>/assets/biblioteca.html` para ver todos los recursos visuales y pedir uno por su nombre. No repitas el contenido de la presentación en el chat.

## Si la petición cambia el formato

- Otro formato explícito (PowerPoint, PDF, Markdown): aplica los pasos 0 a 7 y 9 y produce ese formato con su skill.
- Explicación rápida en el chat («dime en una línea qué hace X»): responde directamente, sin presentación.
