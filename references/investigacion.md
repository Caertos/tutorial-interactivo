# Detección, investigación y verificación

## Índice
1. Detectar el proyecto
2. Detectar el dialecto SQL y el esquema (modo `datos`)
3. Trazar un flujo en el código real (modo `flujo`)
4. Investigar la documentación
5. Verificar ejecutando
6. Plantilla de ficha técnica

---

## 1. Detectar el proyecto

| Situación | Dónde está el proyecto |
|---|---|
| Dentro del directorio de trabajo | El directorio actual y sus padres hasta la raíz (`git rev-parse --show-toplevel`). |
| Sin archivos | Código pegado en el chat. Si no hay nada, no hay proyecto: usa el stack de la petición y la última versión estable. |

| Archivo | Indica | Versión exacta en |
|---|---|---|
| `package.json` | Node / JS / TS; `"type": "module"` = ESM | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb` |
| `tsconfig.json` | TypeScript; `module`, `target`, `strict` | — |
| `next.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*`, `astro.config.*` | Framework de frontend | lockfile |
| `pyproject.toml`, `requirements*.txt`, `Pipfile` | Python | `poetry.lock`, `uv.lock`, `Pipfile.lock` |
| `go.mod` · `Cargo.toml` · `pom.xml`/`build.gradle(.kts)` · `composer.json` · `Gemfile` · `*.csproj` · `pubspec.yaml` | Go · Rust · Java/Kotlin · PHP · Ruby · .NET · Dart | `go.sum` · `Cargo.lock` · el propio archivo · `composer.lock` · `Gemfile.lock` · el propio archivo · `pubspec.lock` |
| `Dockerfile`, `.nvmrc`, `.python-version`, `.tool-versions` | Versión del runtime | — |

```bash
git rev-parse --show-toplevel 2>/dev/null; ls -a
node -p "require('<paquete>/package.json').version" 2>/dev/null
pip show <paquete> 2>/dev/null | head -3
grep -rn "<unidad>" --include="*.<ext>" . | grep -v node_modules | head -20
```

Anota en la ficha:

```
Proyecto: <nombre>
Lenguaje: <TypeScript 5.4 (strict) | Python 3.12 | …>
Librería de la unidad: <react 18.3.1>
Módulos y estilo: <ESM, alias @/; comillas dobles; punto y coma>
Uso actual de la unidad: <no se usa | 4 usos en src/hooks, uno incorrecto>
```

En un monorepo, toma el paquete más cercano al directorio actual o al archivo que mencionó la persona.

---

## 2. Detectar el dialecto SQL y el esquema (modo `datos`)

El dialecto cambia la sintaxis y los resultados (`LIMIT` frente a `TOP`, `ILIKE`, orden de `NULL`, división entera, `GROUP BY` estricto). Búscalo en este orden:

| Fuente | Qué mirar |
|---|---|
| `prisma/schema.prisma` | `datasource db { provider = "postgresql" }`; los `model` dan tablas, tipos y relaciones. |
| Migraciones (`migrations/`, `prisma/migrations/`, `db/migrate/`, `alembic/`, `*.sql`) | Sintaxis propia del motor (`SERIAL`, `AUTO_INCREMENT`, `IDENTITY`), `CREATE TABLE` con claves e índices. |
| `docker-compose.yml` | Imagen del servicio (`postgres:16`, `mysql:8`, `mariadb`, `mcr.microsoft.com/mssql`) y su versión. |
| Configuración del ORM | `knexfile`, `ormconfig`, `drizzle.config.*`, `sequelize`, `settings.py` (`ENGINE`), `database.yml` (`adapter`), `application.properties`. |
| Cadenas de conexión | Solo el esquema de la URL (`postgres://`, `mysql://`, `sqlite:`). **No leas ni copies secretos**: en `.env` mira únicamente el prefijo, por ejemplo `grep -o '^DATABASE_URL=[a-z+]*:' .env`. |

Sin proyecto ni pista en la petición: usa SQL estándar que funcione en SQLite y PostgreSQL, y dilo en la portada. Si hay varias bases de datos o el esquema contradice la petición, pregunta (ver SKILL.md, paso 2).

Esquema real: cuando la pregunta es sobre la base de la persona, toma tablas, columnas, tipos y claves del esquema o las migraciones, nunca de suposiciones. Los datos de ejemplo pueden ser inventados pero con la forma real (mismas columnas y tipos), y se marca que son de ejemplo.

---

## 3. Trazar un flujo en el código real (modo `flujo`)

Cuando la pregunta es «cómo viaja X en mi app», el tema es su código: trázalo, no lo inventes.

1. Encuentra el punto de entrada: la ruta, el evento o el comando que nombra la persona (`grep -rn "/api/pedidos"`, el formulario, el `onClick`).
2. Si existe `<raíz>/.codegraph/`, usa CodeGraph (`codegraph_explore` con los símbolos de la ruta, o `codegraph callees <símbolo>`) para obtener la cadena de llamadas. Si no, lee en orden: ruta → controlador o handler → servicio → repositorio u ORM → consulta.
3. Para cada salto anota: archivo y línea, qué recibe, qué transforma, qué devuelve y la forma de los datos (petición HTTP, DTO, consulta SQL generada, filas, JSON de respuesta, lo que renderiza la vista).
4. Anota también middleware, validación, caché y manejo de errores que el dato atraviesa: suelen ser la respuesta a «qué pasa cuando…».
5. Si aparecen dos caminos posibles (dos handlers, una rama por rol, un flag), pregunta cuál interesa antes de construir.

Cada capa del visual `capas` o actor de `secuencia` debe corresponder a una entrada de esta traza con su ruta de archivo en la ficha.

---

## 4. Investigar la documentación

Orden de fuentes (de más a menos fiable):

1. **Código y tipos instalados**: `node_modules/<paquete>/**/*.d.ts`, `python -c "import x; help(x.y)"`, `go doc`, `cargo doc`. Coinciden con la versión exacta.
2. **Referencia oficial** para esa versión (MDN, docs.python.org, manual del motor SQL, documentación del framework). Usa el selector de versión.
3. **Changelog y guías de migración** si la versión no es la última o la unidad cambió hace poco.
4. **Guías y ejemplos oficiales** para formas de uso idiomáticas.
5. Blogs y foros: solo para detectar errores comunes, nunca como fuente única de un dato.

Cómo buscar: consultas cortas (`<librería> <unidad> api reference`), abre la página con `web_fetch` y lee la sección completa, incluidos parámetros, retorno, excepciones y advertencias. Si remite a otro tipo (`options: RequestInit`), síguelo.

Qué extraer en modo `api`: firma y sobrecargas; por parámetro tipo, obligatoriedad, valor por defecto, valores válidos y qué pasa con los inválidos; retorno (tipo, forma, asincronía, referencia nueva o la misma, valores nulos); excepciones; efectos secundarios; restricciones de uso; diferencias de versión. En los otros modos, extrae las reglas que el tutorial afirma (orden lógico de SQL, semántica de `NULL`, fases del bucle de eventos, formato de un objeto de git) con su fuente.

---

## 5. Verificar ejecutando

Todo resultado que la presentación muestre (tablas intermedias, salidas, órdenes de impresión, estados de un repositorio) sale de una ejecución real. Guarda la prueba en la carpeta de trabajo.

| Qué | Cómo |
|---|---|
| SQL | `sqlite3` (disponible casi siempre): crea las tablas, inserta los datos de ejemplo, ejecuta cada consulta y cada etapa intermedia. Si el dialecto lo exige y hay motor (`duckdb`, `psql` contra una base desechable), úsalo. Guarda `datos.sql` con el esquema, los datos, las consultas y su salida (`sqlite3 -header -column :memory: < datos.sql`). |
| JavaScript / Node | `node -e '<código>'` o un archivo temporal; para el orden del bucle de eventos, imprime y copia la salida exacta. |
| Python | `python3 -c '<código>'` en el entorno del proyecto si hay uno. |
| git | Repositorio desechable en un directorio temporal (`d=$(mktemp -d) && git -C "$d" init`), con los commits del ejemplo; copia `git log --oneline --graph --all` antes y después. Nunca en el repositorio de la persona. |
| Comandos de terminal | Ejecútalos en un directorio temporal con archivos de juguete. |

Si algo no se puede ejecutar (servicio externo, motor no disponible, efecto destructivo), márcalo «no confirmado» en la ficha y no lo presentes como hecho; si es imprescindible, dilo en la diapositiva.

Si un resultado verificado contradice lo planeado (otro orden de filas, un `NULL` inesperado), corrige el guion; si cambia el enfoque, pregunta.

---

## 6. Plantilla de ficha técnica

Guárdala como `ficha.md` en la carpeta de trabajo. Toda afirmación de la presentación se rastrea hasta una línea de aquí.

```markdown
# Ficha: <unidad o idea>

- Modo: <api | datos | flujo | concepto>
- Paquete / motor: <example 2.1.0 | PostgreSQL 16> (detectado en <archivo> | supuesto: <motivo>)
- Tipo (api): <función | método | clase | hook | componente | comando | endpoint | opción>
- Importación / dónde existe: `<import { sum } from "example">`
- Firma (api): `<sum(a: number, b: number): number>`
- Qué hace o qué explica (una frase): <…>
- Nivel: <básico | intermedio | avanzado> · Ejemplo: <análogo: … | caso real de la persona>

## Preguntas y respuestas
| Pregunta | Respuesta | Efecto en el tutorial |
|---|---|---|
| <¿Ejemplo análogo o tu caso real?> | <análogo> | <alumnos y cursos en vez de pedidos> |

## Suposiciones
- <detalle menor decidido sin preguntar; se muestra en la portada>

## Parámetros (api)
| Nombre | Tipo | Obligatorio | Por defecto | Significado | Válidos | Inválidos / qué pasa |
|---|---|---|---|---|---|---|

## Retorno, errores y efectos (api)
- Retorno: <tipo, forma, asincronía, valores especiales>
- Errores: <…> · Efectos secundarios: <…>

## Reglas que se enseñan (datos, flujo, concepto)
- <regla> — fuente: <URL o archivo:línea>

## Traza del flujo (flujo)
| # | Capa | Archivo:línea | Recibe | Hace | Devuelve (forma) |
|---|---|---|---|---|---|

## Dataset y resultados reales
- Motor: <sqlite3 3.45 | node 22.4 | git 2.45> · Archivo: <datos.sql>
- Esquema y datos: <tablas y filas usadas, o enlace a datos.sql>
- Consulta o código → salida exacta:
  ```
  <consulta>
  <salida copiada de la ejecución>
  ```

## Formas de uso
- A: <…> · B: <…>

## Errores comunes
- <qué pasa · por qué · cómo evitarlo>

## Plan visual
| Diapositiva | Idea | Forma | Recurso | Motivo |
|---|---|---|---|---|

## Notas de versión
- <…>

## No confirmado
- <dato no verificable; no se usa como hecho>

## Fuentes
- <URL oficial> (consultada <fecha>) · <ruta local>
```
