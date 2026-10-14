-- =====================================================================
-- QUINTA MIGRACIÓN DE LA PARTE 3 (Ángulo de las fotos de progreso)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Agrega una sola columna a una tabla que ya existe (client_files), para
-- poder etiquetar cada foto como de frente, de espalda, lado derecho o
-- lado izquierdo. No borra ni modifica nada de lo que ya tenés cargado.
-- =====================================================================

alter table public.client_files
  add column if not exists angle text check (angle in ('front', 'back', 'left', 'right'));
