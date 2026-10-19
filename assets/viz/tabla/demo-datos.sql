-- Provenance for viz/tabla/demo.html. Run: sqlite3 < demo-datos.sql
.headers on
.mode list
.nullvalue NULL
CREATE TABLE alumnos(id INTEGER PRIMARY KEY, nombre TEXT, edad INTEGER, curso_id INTEGER REFERENCES cursos(id));
INSERT INTO alumnos VALUES (1,'Ana',19,10),(2,'Luis',17,20),(3,'Eva',NULL,10),(4,'Iván',22,NULL),(5,'Sara',18,30);
.print -- tabla base
SELECT * FROM alumnos ORDER BY id;
.print -- columna calculada: edad >= 18
SELECT id, nombre, edad, curso_id, edad >= 18 AS "edad >= 18" FROM alumnos ORDER BY id;
.print -- WHERE edad >= 18
SELECT * FROM alumnos WHERE edad >= 18 ORDER BY id;

-- ---- Output (3.54.1 2026-10-16) ----
-- -- tabla base
-- id|nombre|edad|curso_id
-- 1|Ana|19|10
-- 2|Luis|17|20
-- 3|Eva|NULL|10
-- 4|Iván|22|NULL
-- 5|Sara|18|30
-- -- columna calculada: edad >= 18
-- id|nombre|edad|curso_id|edad >= 18
-- 1|Ana|19|10|1
-- 2|Luis|17|20|0
-- 3|Eva|NULL|10|NULL
-- 4|Iván|22|NULL|1
-- 5|Sara|18|30|1
-- -- WHERE edad >= 18
-- id|nombre|edad|curso_id
-- 1|Ana|19|10
-- 4|Iván|22|NULL
-- 5|Sara|18|30
