-- Provenance for viz/orden-sql/demo.html. Run: sqlite3 < demo-datos.sql
-- Each intermediate table shown in the demo is the output of one query below.
.headers on
.mode list
.nullvalue NULL
CREATE TABLE notas(alumno TEXT, materia TEXT, nota INTEGER);
INSERT INTO notas VALUES ('Ana','Mate',8),('Ana','Arte',4),('Luis','Mate',6),('Luis','Arte',9),
  ('Eva','Mate',3),('Eva','Física',7),('Iván','Arte',7),('Iván','Física',5),('Sara','Música',10);
.print -- FROM notas
SELECT rowid, alumno, materia, nota FROM notas ORDER BY rowid;
.print -- WHERE nota >= 5 (rows kept)
SELECT rowid, alumno, materia, nota FROM notas WHERE nota >= 5 ORDER BY rowid;
.print -- GROUP BY materia (rows by group)
SELECT materia, alumno, nota FROM notas WHERE nota >= 5 ORDER BY materia, rowid;
.print -- groups before HAVING
SELECT materia, COUNT(*) AS n, AVG(nota) AS media FROM notas WHERE nota >= 5 GROUP BY materia ORDER BY materia;
.print -- HAVING COUNT(*) >= 2 + SELECT
SELECT materia, COUNT(*) AS n, AVG(nota) AS media FROM notas WHERE nota >= 5 GROUP BY materia HAVING COUNT(*) >= 2 ORDER BY materia;
.print -- ORDER BY media DESC
SELECT materia, COUNT(*) AS n, AVG(nota) AS media FROM notas WHERE nota >= 5 GROUP BY materia HAVING COUNT(*) >= 2 ORDER BY media DESC;
.print -- LIMIT 2 (final)
SELECT materia, COUNT(*) AS n, AVG(nota) AS media FROM notas WHERE nota >= 5 GROUP BY materia HAVING COUNT(*) >= 2 ORDER BY media DESC LIMIT 2;

-- ---- Output (3.54.1 2026-10-16) ----
-- -- FROM notas
-- rowid|alumno|materia|nota
-- 1|Ana|Mate|8
-- 2|Ana|Arte|4
-- 3|Luis|Mate|6
-- 4|Luis|Arte|9
-- 5|Eva|Mate|3
-- 6|Eva|Física|7
-- 7|Iván|Arte|7
-- 8|Iván|Física|5
-- 9|Sara|Música|10
-- -- WHERE nota >= 5 (rows kept)
-- rowid|alumno|materia|nota
-- 1|Ana|Mate|8
-- 3|Luis|Mate|6
-- 4|Luis|Arte|9
-- 6|Eva|Física|7
-- 7|Iván|Arte|7
-- 8|Iván|Física|5
-- 9|Sara|Música|10
-- -- GROUP BY materia (rows by group)
-- materia|alumno|nota
-- Arte|Luis|9
-- Arte|Iván|7
-- Física|Eva|7
-- Física|Iván|5
-- Mate|Ana|8
-- Mate|Luis|6
-- Música|Sara|10
-- -- groups before HAVING
-- materia|n|media
-- Arte|2|8.0
-- Física|2|6.0
-- Mate|2|7.0
-- Música|1|10.0
-- -- HAVING COUNT(*) >= 2 + SELECT
-- materia|n|media
-- Arte|2|8.0
-- Física|2|6.0
-- Mate|2|7.0
-- -- ORDER BY media DESC
-- materia|n|media
-- Arte|2|8.0
-- Mate|2|7.0
-- Física|2|6.0
-- -- LIMIT 2 (final)
-- materia|n|media
-- Arte|2|8.0
-- Mate|2|7.0
