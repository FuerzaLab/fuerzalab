-- =====================================================================
-- SÉPTIMA MIGRACIÓN DE LA PARTE 3 (Fotos y videos de demostración en
-- Ejercicios)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Agrega dos columnas a una tabla que ya existe (exercises). No borra ni
-- modifica nada de lo que ya tenés cargado. El espacio de almacenamiento
-- para estos archivos (exercise-media) ya estaba creado y configurado
-- desde el script original — nunca se había conectado a ninguna pantalla.
-- =====================================================================

alter table public.exercises
  add column if not exists media_path text,
  add column if not exists media_type text check (media_type in ('image', 'video'));
