-- =====================================================================
-- DECIMOCUARTA MIGRACIÓN DE LA PARTE 3 (Equipo: asistentes que pueden eliminar)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Desde el script original, un asistente (staff) con permiso "Ver y
-- editar" sobre un módulo podía crear y modificar cosas, pero NO
-- eliminarlas: las reglas de borrado eran solo del entrenador. Y como
-- Supabase no da error cuando una regla de seguridad filtra un borrado
-- (simplemente no borra nada), la pantalla habría mostrado la fila como
-- eliminada y al recargar habría vuelto a aparecer.
--
-- Esto agrega, en cada tabla que ya da acceso al staff por módulo, una
-- regla extra que le permite eliminar cuando tiene "Ver y editar" en ese
-- módulo. No reemplaza ni toca ninguna regla existente — solo suma una.
--
-- Excepción a propósito: la tabla de clientes. Eliminar un cliente por
-- completo sigue siendo solo del entrenador (el asistente puede "Dar de
-- baja", que conserva el historial).
--
-- Se puede volver a correr sin problema: borra y recrea solo sus propias
-- reglas (las que se llaman p_delete_staff).
-- =====================================================================

do $$
declare
  r record;
  v_module text;
begin
  for r in
    select tablename, qual
    from pg_policies
    where schemaname = 'public'
      and policyname = 'p_select'
      and qual ~ 'staff_can\(trainer_id, '''
      and tablename <> 'clients'
  loop
    v_module := substring(r.qual from 'staff_can\(trainer_id, ''([a-z_]+)''');
    if v_module is null then
      continue;
    end if;
    execute format('drop policy if exists p_delete_staff on public.%I', r.tablename);
    execute format(
      'create policy p_delete_staff on public.%I for delete to authenticated using '
      '(organization_id = public.auth_org() and public.staff_can(trainer_id, %L, ''write''))',
      r.tablename, v_module);
    raise notice 'Asistentes pueden eliminar en %: módulo %', r.tablename, v_module;
  end loop;
end $$;

-- Para revisar qué tablas quedaron cubiertas (opcional):
-- select tablename, qual from pg_policies where policyname = 'p_delete_staff' order by tablename;
