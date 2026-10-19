-- Provenance for grafico/demo.html (sqlite3). Run: sqlite3 :memory: < demo-datos.sql
CREATE TABLE ventas (id INTEGER PRIMARY KEY, categoria TEXT NOT NULL, trimestre TEXT NOT NULL, importe REAL NOT NULL);
INSERT INTO ventas (categoria, trimestre, importe) VALUES
  ('Café', 'T1', 120), ('Café', 'T1', 95), ('Café', 'T2', 140), ('Café', 'T2', 130),
  ('Té', 'T1', 80), ('Té', 'T1', 60), ('Té', 'T2', 55),
  ('Tazas', 'T1', 150), ('Tazas', 'T2', 90), ('Tazas', 'T2', 120),
  ('Filtros', 'T1', 30), ('Filtros', 'T1', 25), ('Filtros', 'T2', 45);
.headers on
.mode list
.separator " | "
SELECT categoria, trimestre, SUM(importe) AS total
FROM ventas
GROUP BY categoria, trimestre
ORDER BY categoria, trimestre;
-- Output (sqlite3 3.54.1):
-- categoria | trimestre | total
-- Café | T1 | 215.0
-- Café | T2 | 270.0
-- Filtros | T1 | 55.0
-- Filtros | T2 | 45.0
-- Tazas | T1 | 150.0
-- Tazas | T2 | 210.0
-- Té | T1 | 140.0
-- Té | T2 | 55.0
