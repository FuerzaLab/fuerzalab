-- =====================================================================
-- DECIMOSEXTA MIGRACIÓN DE LA PARTE 3 (Super Admin edita cualquier ejercicio)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- La pantalla "Ejercicios globales" del Super Admin muestra TODOS los
-- ejercicios de la plataforma: los globales y también los que creó cada
-- entrenador en su propia biblioteca. Hasta ahora el Super Admin solo
-- podía editar o eliminar los globales — los de un entrenador solo los
-- podía tocar su dueño.
--
-- Esto le da al Super Admin permiso para editar y eliminar cualquier
-- ejercicio (y su foto/video y sus alternativas). Para entrenadores y
-- asistentes no cambia nada: siguen pudiendo tocar solo los suyos.
-- Reemplaza una sola función; no toca tablas ni datos.
-- =====================================================================

create or replace function public.exercise_writable(p_scope text, p_org uuid, p_owner uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    public.is_super_admin()
    or (p_scope in ('organization','trainer') and p_org = public.auth_org() and (
          (public.auth_role() = 'trainer' and p_owner = auth.uid())
          or (public.auth_role() = 'staff' and p_scope = 'trainer' and public.staff_can(p_owner, 'exercises', 'write'))
       )), false)
$$;
