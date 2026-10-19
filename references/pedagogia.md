# Pedagogía: ejemplo, secuencias y plan visual

## Índice
1. Elegir el ejemplo
2. Profundidad y número de diapositivas
3. Secuencias base por modo
4. Variantes del modo `api` por tipo de unidad
5. Plan visual
6. Escritura

---

## 1. Elegir el ejemplo

### Regla por defecto: ejemplo análogo

Cuando se enseña una herramienta, API o concepto, no uses como ejemplo lo que la persona quiere construir. Si el ejemplo es su caso, copia la solución sin entender la herramienta y no sabrá adaptarla; además su dominio trae ruido (nombres de negocio, dependencias) que tapa la mecánica. El ejemplo análogo aísla la mecánica y la diapositiva «Llévalo a tu caso» hace el puente.

### Excepción: el tema es su sistema

Si la pregunta es sobre su propio sistema («cómo viaja X en mi app», «explícame mi query», «qué hace este servicio nuestro»), el tema **es** su código. Traza su código real y usa su esquema y la forma real de sus datos (ver `investigacion.md`, secciones 2 y 3). No inventes capas, tablas ni campos. Los valores pueden ser de ejemplo si los reales son sensibles, pero con su forma, y marcados como ejemplo. Aquí no hace falta «Llévalo a tu caso»: termina con «Dónde está en tu código» (archivo y línea de cada pieza).

También se usa su caso si lo pide explícitamente («hazlo con mis datos»). Si no está claro cuál de los dos quiere, es una pregunta inicial.

### Criterios de un buen ejemplo análogo

1. **Misma mecánica**: los mismos parámetros, tipo de retorno, asincronía, cardinalidad o ciclo de vida.
2. **Dominio universal**: temperaturas, notas, una biblioteca, una receta, un termostato. Nada que requiera explicar el dominio.
3. **Datos mínimos**: 3 a 6 filas o elementos, números calculables de cabeza, resultados exactos (sin sorpresas binarias salvo que sean el tema). Incluye a propósito el caso que enseña algo: una clave repetida, un `NULL`, una fila sin pareja.
4. **Un hilo conductor**: el mismo ejemplo en todas las diapositivas, ganando complejidad.
5. **Stack del proyecto**: mismo lenguaje, dialecto, sintaxis de importación y convenciones.

### Ejemplos de traducción

| Caso de la persona | Unidad o idea | Ejemplo análogo |
|---|---|---|
| Filtrar pedidos pendientes | `Array.prototype.filter` | Días de más de 25 °C en una semana |
| Cargar productos en un componente | `useEffect` + `fetch` | Reloj que se actualiza cada segundo; luego un chiste de una API pública |
| Validar el formulario de registro | `zod.object().parse` | Ficha de una mascota (nombre, edad, especie) |
| Unir ventas con clientes | `LEFT JOIN` | Alumnos y cursos, con un alumno sin curso y un curso sin alumnos |
| Ventas totales por región | `GROUP BY` + `HAVING` | Gasto de una cafetería por categoría (café, té, bollería) |
| Su consulta lenta de facturas | índices y `EXPLAIN` | Biblioteca de 12 libros buscados por autor, con y sin índice |
| Paginar facturas | `LIMIT/OFFSET` | 12 películas de 5 en 5 |
| Cómo funciona su API de pagos (genérico) | petición cliente → API → BD | Pedir un café en una app: navegador → API → servicio → base de datos → tarjeta en pantalla |
| Login con su proveedor | OAuth 2 | Una app de recetas que entra con «Iniciar sesión con…» |
| Reescribir su rama | `git rebase -i` | Repositorio de juguete con tres commits de una receta |
| Bug de orden en sus logs | bucle de eventos | Tres `console.log` con `setTimeout` y `Promise.then` |
| Mutación inesperada de su estado | referencias frente a valores | Dos variables que apuntan a la misma lista de la compra |

### Diapositiva «Llévalo a tu caso»

Tabla de dos columnas: pieza del ejemplo → su equivalente en el caso de la persona, más una o dos frases sobre qué tendrá que decidir. No escribas su código final.

---

## 2. Profundidad y número de diapositivas

| Nivel | Diapositivas | Qué cambia |
|---|---|---|
| Básico | 8–12 | Explica cada término la primera vez; un uso principal; errores más frecuentes. |
| Intermedio | 10–14 | Formas de uso alternativas, casos límite, rendimiento cuando importa. |
| Avanzado | hasta 16 | Internos, versiones, interacción con otras piezas. Menos repaso de lo básico. |

Más de 16 indica que el tema es demasiado grande: propón dividirlo en varias presentaciones y construye la primera. Una diapositiva, una idea.

---

## 3. Secuencias base por modo

Adapta cada secuencia al tema; los recursos son sugerencias, la elección final sale del plan visual (sección 5).

### Modo `api` (función, método, clase, hook, componente, comando, endpoint, configuración)

| # | Diapositiva | Qué debe quedar claro | Recurso sugerido |
|---|---|---|---|
| 1 | Portada | Qué es y qué consigue, en una frase | Portada con firma |
| 2 | Cómo se obtiene | Importación, instalación o dónde existe | Código con notas |
| 3 | Anatomía | Nombre, parámetros y retorno en la firma | Código con notas |
| 4…n | Un parámetro por diapositiva | Tipo, obligatorio, defecto, válidos e inválidos | Ficha de parámetro |
| n+1 | Qué hace | La transformación de entradas a salida | `maquina` o `traza` |
| n+2 | Qué devuelve | Tipo y forma del retorno, valores especiales | Retorno |
| n+3… | Formas de uso A, B, (C) | 2 o 3 patrones, cada uno con cuándo usarlo | Código con notas, `antes-despues` |
| — | Qué evitar | Errores con causa y solución | Tabla de casos |
| — | Pruébalo | Practicar | Playground o quiz |
| — | Llévalo a tu caso | Puente al problema real | Puente |
| — | Resumen | Chuleta para volver | Resumen |

Ajustes: más de 4 parámetros → agrupa los opcionales poco usados en una tabla; objeto de opciones → una diapositiva para el objeto y diapositiva propia solo para las 2 o 3 claves más usadas; sobrecargas → en «Formas de uso»; sin parámetros → «Cuándo se ejecuta» o «Qué lee».

### Modo `datos` (tablas, JOIN, GROUP BY, índices, ejecución de consultas, esquemas, transformaciones)

| # | Diapositiva | Qué debe quedar claro | Recurso sugerido |
|---|---|---|---|
| 1 | Portada | La pregunta que responde la consulta o idea | Portada |
| 2 | Los datos | Tablas, columnas, tipos, claves y `NULL` del ejemplo | `tabla` |
| 3 | La consulta | Cada cláusula y su papel | Código con notas |
| 4 | Orden de ejecución | Cómo la evalúa el motor (si aporta) | `orden-sql` |
| 5…n | Una operación por diapositiva | Qué hace cada paso con las filas: filtrar, combinar, agrupar | `tabla`, `join`, `orden-sql` |
| — | El resultado | Filas finales y por qué son esas | `tabla` o `grafico` |
| — | Casos que sorprenden | Claves repetidas, `NULL`, filas sin pareja, `WHERE` frente a `HAVING` | `join`, tabla de casos |
| — | Rendimiento (intermedio+) | Índice, plan, cuándo importa | `arbol`, `antes-despues` |
| — | Predice el resultado | Practicar con salidas reales | Quiz |
| — | Llévalo a tu caso / Dónde está en tu esquema | Puente | Puente |
| — | Resumen | Chuleta | Resumen |

Cada tabla mostrada es salida real del motor (ver `investigacion.md`, sección 5).

### Modo `flujo` (cómo viajan datos o peticiones por las capas de un sistema; protocolos)

| # | Diapositiva | Qué debe quedar claro | Recurso sugerido |
|---|---|---|---|
| 1 | Portada | Qué viaja y desde dónde hasta dónde | Portada |
| 2 | El mapa | Las capas o actores que intervienen y qué hace cada uno | `capas` (paso 0) o `grafo` |
| 3 | El viaje de ida | Cada salto: qué se envía y con qué forma | `capas` o `secuencia` |
| 4 | Dentro de la capa clave | El servicio, la consulta o la transformación central | Código con notas, `tabla` |
| 5 | El viaje de vuelta | Cómo cambia la forma de los datos hasta la respuesta | `capas` |
| 6 | Lo que ve la persona | El resultado renderizado | `capas` (`render`) |
| — | Cuando algo falla | Errores, reintentos, caché, validación | `estado`, `linea-tiempo` |
| — | Tiempos (si importa) | Qué ocurre en paralelo y qué espera | `linea-tiempo` |
| — | Dónde está en tu código / Llévalo a tu caso | Archivo y línea de cada capa, o puente | Puente |
| — | Resumen | Chuleta | Resumen |

### Modo `concepto` (bucle de eventos, referencias, máquinas de estados, internos de git, algoritmos…)

| # | Diapositiva | Qué debe quedar claro | Recurso sugerido |
|---|---|---|---|
| 1 | Portada | La pregunta que resuelve el concepto | Portada |
| 2 | El problema | Una situación concreta que sin el concepto confunde | Código, quiz |
| 3 | El modelo mental | Las piezas del concepto y cómo se relacionan | Según su forma (sección 5) |
| 4…n | Paso a paso | El modelo aplicado al ejemplo, un paso por «Siguiente» | `traza`, `linea-tiempo`, `memoria`, `estado`, `grafo`, `cuadricula`, `arbol` |
| — | Variaciones | Un cambio en la entrada y cómo cambia el resultado | `antes-despues`, quiz |
| — | Errores de intuición | Lo que la gente suele creer y por qué falla | Tabla de casos |
| — | Predice el resultado | Practicar con salidas reales | Quiz |
| — | Llévalo a tu caso | Puente | Puente |
| — | Resumen | Chuleta | Resumen |

---

## 4. Variantes del modo `api` por tipo de unidad

| Tipo | Cambios en la secuencia |
|---|---|
| Método de instancia (`arr.map`) | En «Cómo se obtiene», de qué objeto sale. Indica si muta o devuelve uno nuevo. |
| Método estático (`Object.keys`) | Se llama sobre la clase; muéstralo junto al error típico. |
| Clase | «Anatomía» pasa a «Constructor»; añade las 2 a 4 propiedades y métodos más usados. |
| Asíncrona / promesa | En «Qué devuelve», la promesa y lo que resuelve por separado; `await` y `.then`; olvidar `await` y no gestionar el rechazo. |
| Hook | «Reglas de uso» antes de las formas de uso; «Qué hace» sobre el ciclo de renders (`linea-tiempo`). |
| Componente de UI | Los parámetros son props; «Qué devuelve» pasa a «Qué se ve» (maqueta en HTML). |
| Comando de terminal | «Cómo se obtiene» = instalación; argumentos y flags; salida y código de salida; quiz «Predice la salida». |
| Opción de configuración | Dónde va (archivo y clave), valores, valor por defecto y qué cambia con cada uno. |
| Endpoint HTTP | Método y ruta, parámetros de ruta, consulta y cuerpo, códigos de estado y forma de la respuesta; `secuencia` si hay varios actores. |

---

## 5. Plan visual

Después del guion y antes de construir. Por cada diapositiva:

1. **Forma de la idea**: clasifícala con el vocabulario de la columna «Forma» de `references/catalogo.md` (transformación, iteración, datos tabulares, combinación, flujo entre capas, petición-respuesta, estados, tiempo, referencias, jerarquía, dependencias, comparación, cantidades…).
2. **Recurso**: el módulo o componente cuya forma coincide. Lee su «Cuándo no» antes de elegirlo; si la idea cae ahí, usa la alternativa que indica.
3. **Mínimo que explica**: un visual por diapositiva como mucho, y solo si explica mejor que el texto. No hay cuota: una diapositiva puede ir sin visual con una línea que diga por qué («la regla cabe en una frase»).
4. **Sin coincidencia**: visual ad hoc con tokens y motor del núcleo (`diseno.md`, sección 7), anotando por qué ningún módulo servía.

Nunca elijas por vistoso. Si la persona nombra un módulo en la petición, úsalo donde encaje.

Registra la tabla en la ficha:

| Diapositiva | Idea | Forma | Recurso | Motivo |
|---|---|---|---|---|
| 4 | Qué filas sobreviven al LEFT JOIN | combinación | `join` | Hay que ver la fila sin pareja rellena con NULL |
| 7 | WHERE filtra antes de agrupar | orden de ejecución | `orden-sql` | El error viene de leer la consulta en orden de escritura |
| 9 | Regla de NULL en COUNT | — | sin visual | Cabe en una frase con un ejemplo de código |

---

## 6. Escritura

- Frases cortas, voz activa, segunda persona (tú, o usted si la persona lo usa).
- Explica cada término técnico la primera vez, en media frase.
- Nombra las cosas por lo que hacen para la persona: «guarda lo que devuelve», no «asigna el valor de retorno».
- Cada error con tres partes: qué pasa, por qué, cómo evitarlo.
- Títulos descriptivos en minúscula salvo la inicial («Qué devuelve», «Forma B: sumar una lista»).
- Las leyendas de los pasos de un módulo dicen qué mirar, no repiten lo que se ve.
- Sin relleno: si una frase no ayuda a entender o usar el tema, se elimina.
