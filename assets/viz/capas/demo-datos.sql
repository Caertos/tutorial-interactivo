-- Provenance for capas/demo.html (sqlite3). Run: sqlite3 :memory: < demo-datos.sql
CREATE TABLE pedidos (id INTEGER PRIMARY KEY, usuario_id INTEGER NOT NULL, estado TEXT NOT NULL);
CREATE TABLE lineas_pedido (id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  producto TEXT NOT NULL, cantidad INTEGER NOT NULL, precio REAL NOT NULL);
INSERT INTO pedidos VALUES (41, 3, 'entregado'), (42, 7, 'enviado'), (43, 7, 'pendiente');
INSERT INTO lineas_pedido VALUES
  (1, 41, 'Té verde', 1, 4.5),
  (2, 42, 'Café molido', 2, 4.5),
  (3, 42, 'Taza de cerámica', 1, 12.5),
  (4, 43, 'Filtros de papel', 3, 1.2);
.mode list
.headers on
.separator " | "
SELECT p.id, p.estado, l.producto, l.cantidad, l.precio
FROM pedidos p
JOIN lineas_pedido l ON l.pedido_id = p.id
WHERE p.id = 42 AND p.usuario_id = 7
ORDER BY l.id;
SELECT SUM(l.cantidad * l.precio) AS total FROM lineas_pedido l WHERE l.pedido_id = 42;
-- Output (sqlite3 3.54.1):
-- id | estado | producto | cantidad | precio
-- 42 | enviado | Café molido | 2 | 4.5
-- 42 | enviado | Taza de cerámica | 1 | 12.5
-- total
-- 21.5
