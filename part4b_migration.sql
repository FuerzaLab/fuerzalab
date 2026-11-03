-- =====================================================================
-- SEGUNDA MIGRACIÓN DE LA PARTE 4 (Patrón "Accesorio" y región del cuerpo)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
--  * Agrega "Accesorio" a los patrones de movimiento (para todos).
--  * Cada ejercicio puede guardar a qué región corresponde: Tren superior,
--    Tren inferior o Full body. Hasta ahora se deducía del grupo muscular;
--    se sigue haciendo así para los ejercicios que no la tengan elegida.
-- =====================================================================

insert into public.catalog_items (organization_id, kind, key, label, sort_order)
select null, 'movement_pattern', 'accesorio', 'Accesorio', 12
where not exists (
  select 1 from public.catalog_items
   where organization_id is null and kind = 'movement_pattern' and key = 'accesorio'
);

alter table public.exercises
  add column if not exists body_region text check (body_region in ('Superior', 'Inferior', 'Full body'));
