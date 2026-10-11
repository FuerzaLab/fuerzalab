-- =====================================================================
-- CATÁLOGO INICIAL DE EJERCICIOS (opcional, recomendado)
-- Pega esto en el SQL Editor DESPUÉS de supabase_setup.sql, una sola vez.
--
-- supabase_setup.sql crea la tabla catalog_items pero no carga ningún
-- dato: sin esto, los desplegables de "músculo" y "equipamiento" al
-- crear un ejercicio aparecerían vacíos. Esto carga una lista base en
-- español; puedes editarla o agregar más después desde la tabla
-- catalog_items si lo necesitas.
-- =====================================================================

insert into public.catalog_items (kind, key, label, sort_order) values
  ('muscle_group', 'pecho', 'Pecho', 1),
  ('muscle_group', 'espalda', 'Espalda', 2),
  ('muscle_group', 'hombros', 'Hombros', 3),
  ('muscle_group', 'biceps', 'Bíceps', 4),
  ('muscle_group', 'triceps', 'Tríceps', 5),
  ('muscle_group', 'cuadriceps', 'Cuádriceps', 6),
  ('muscle_group', 'isquiotibiales', 'Isquiotibiales', 7),
  ('muscle_group', 'gluteos', 'Glúteos', 8),
  ('muscle_group', 'pantorrillas', 'Pantorrillas', 9),
  ('muscle_group', 'core', 'Core / abdomen', 10),
  ('muscle_group', 'cuerpo_completo', 'Cuerpo completo', 11),
  ('muscle_group', 'cardio', 'Cardio', 12)
on conflict do nothing;

insert into public.catalog_items (kind, key, label, sort_order) values
  ('movement_pattern', 'sentadilla', 'Sentadilla', 1),
  ('movement_pattern', 'bisagra_cadera', 'Bisagra de cadera', 2),
  ('movement_pattern', 'empuje_horizontal', 'Empuje horizontal', 3),
  ('movement_pattern', 'empuje_vertical', 'Empuje vertical', 4),
  ('movement_pattern', 'traccion_horizontal', 'Tracción horizontal', 5),
  ('movement_pattern', 'traccion_vertical', 'Tracción vertical', 6),
  ('movement_pattern', 'zancada', 'Zancada', 7),
  ('movement_pattern', 'rotacion', 'Rotación', 8),
  ('movement_pattern', 'ciclico', 'Cíclico (cardio)', 9),
  ('movement_pattern', 'estabilidad', 'Estabilidad', 10),
  ('movement_pattern', 'flexibilidad', 'Flexibilidad', 11)
on conflict do nothing;

insert into public.catalog_items (kind, key, label, sort_order) values
  ('equipment', 'peso_corporal', 'Peso corporal', 1),
  ('equipment', 'barra', 'Barra', 2),
  ('equipment', 'mancuernas', 'Mancuernas', 3),
  ('equipment', 'maquina', 'Máquina', 4),
  ('equipment', 'polea', 'Polea', 5),
  ('equipment', 'kettlebell', 'Kettlebell', 6),
  ('equipment', 'banda_elastica', 'Banda elástica', 7),
  ('equipment', 'remoergometro', 'Remoergómetro', 8),
  ('equipment', 'bicicleta_estatica', 'Bicicleta estática', 9),
  ('equipment', 'cinta_exterior', 'Cinta o exterior', 10),
  ('equipment', 'ninguno', 'Ninguno', 11)
on conflict do nothing;
