-- Provenance for viz/join/demo.html. Run: sqlite3 < demo-datos.sql
-- The viz computes the joins in JS from the same rows; these outputs confirm row counts and NULL padding.
.headers on
.mode list
.nullvalue NULL
CREATE TABLE alumnos(id INTEGER PRIMARY KEY, nombre TEXT, curso TEXT);
CREATE TABLE horarios(curso TEXT, dia TEXT);
INSERT INTO alumnos VALUES (1,'Ana','Mate'),(2,'Luis','Arte'),(3,'Eva',NULL),(4,'Iván','Mate'),(5,'Sara','Física');
INSERT INTO horarios VALUES ('Mate','lunes'),('Mate','jueves'),('Arte','martes'),('Música','viernes');
.print -- INNER JOIN
SELECT a.id, a.nombre, a.curso, h.curso, h.dia FROM alumnos a INNER JOIN horarios h ON a.curso = h.curso ORDER BY a.id, h.rowid;
.print -- LEFT JOIN
SELECT a.id, a.nombre, a.curso, h.curso, h.dia FROM alumnos a LEFT JOIN horarios h ON a.curso = h.curso ORDER BY a.id, h.rowid;
.print -- RIGHT JOIN
SELECT a.id, a.nombre, a.curso, h.curso, h.dia FROM alumnos a RIGHT JOIN horarios h ON a.curso = h.curso ORDER BY a.id IS NULL, a.id, h.rowid;
.print -- FULL JOIN
SELECT a.id, a.nombre, a.curso, h.curso, h.dia FROM alumnos a FULL JOIN horarios h ON a.curso = h.curso ORDER BY a.id IS NULL, a.id, h.rowid;
.print -- CROSS JOIN (count)
SELECT COUNT(*) AS filas FROM alumnos CROSS JOIN horarios;
.print -- counts per type
SELECT (SELECT COUNT(*) FROM alumnos a JOIN horarios h ON a.curso=h.curso) AS inner_n,
       (SELECT COUNT(*) FROM alumnos a LEFT JOIN horarios h ON a.curso=h.curso) AS left_n,
       (SELECT COUNT(*) FROM alumnos a RIGHT JOIN horarios h ON a.curso=h.curso) AS right_n,
       (SELECT COUNT(*) FROM alumnos a FULL JOIN horarios h ON a.curso=h.curso) AS full_n;

-- ---- Output (3.54.1 2026-10-16) ----
-- -- INNER JOIN
-- id|nombre|curso|curso|dia
-- 1|Ana|Mate|Mate|lunes
-- 1|Ana|Mate|Mate|jueves
-- 2|Luis|Arte|Arte|martes
-- 4|Iván|Mate|Mate|lunes
-- 4|Iván|Mate|Mate|jueves
-- -- LEFT JOIN
-- id|nombre|curso|curso|dia
-- 1|Ana|Mate|Mate|lunes
-- 1|Ana|Mate|Mate|jueves
-- 2|Luis|Arte|Arte|martes
-- 3|Eva|NULL|NULL|NULL
-- 4|Iván|Mate|Mate|lunes
-- 4|Iván|Mate|Mate|jueves
-- 5|Sara|Física|NULL|NULL
-- -- RIGHT JOIN
-- id|nombre|curso|curso|dia
-- 1|Ana|Mate|Mate|lunes
-- 1|Ana|Mate|Mate|jueves
-- 2|Luis|Arte|Arte|martes
-- 4|Iván|Mate|Mate|lunes
-- 4|Iván|Mate|Mate|jueves
-- NULL|NULL|NULL|Música|viernes
-- -- FULL JOIN
-- id|nombre|curso|curso|dia
-- 1|Ana|Mate|Mate|lunes
-- 1|Ana|Mate|Mate|jueves
-- 2|Luis|Arte|Arte|martes
-- 3|Eva|NULL|NULL|NULL
-- 4|Iván|Mate|Mate|lunes
-- 4|Iván|Mate|Mate|jueves
-- 5|Sara|Física|NULL|NULL
-- NULL|NULL|NULL|Música|viernes
-- -- CROSS JOIN (count)
-- filas
-- 20
-- -- counts per type
-- inner_n|left_n|right_n|full_n
-- 5|7|6|8
