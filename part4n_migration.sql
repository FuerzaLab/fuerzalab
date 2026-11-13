-- =====================================================================
-- DECIMOCUARTA MIGRACIÓN DE LA PARTE 4 (Eliminar un alumno por completo)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- "Eliminar" un alumno borra TODO, sin tener que borrar antes sus programas
-- y planes, para cumplir con el pedido de eliminación de datos (Política de
-- privacidad y autorización de tutores):
--  * sus programas y rutinas (incluso las ya entrenadas), sus planes y pagos,
--    su formulario de ingreso, evaluaciones, entrenamientos, bienestar,
--    mensajes, notas y archivos (registros), y sus citas de la Agenda;
--  * su cuenta de acceso (si la creó). Si la cuenta no se puede borrar,
--    se desactiva y se le quitan el nombre y el celular.
-- Los archivos guardados (fotos, comprobantes, autorizaciones) los borra la
-- app antes de llamar a esta función.
-- Solo lo puede hacer el entrenador del alumno (o el Super Admin).
-- =====================================================================

create or replace function public.delete_client_fully(p_client uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c public.clients%rowtype;
begin
  select * into c from public.clients where id = p_client;
  if c.id is null then return false; end if;
  if not (public.is_super_admin() or public.is_trainer_scope(c.organization_id, c.trainer_id)) then
    raise exception 'Solo el entrenador de este alumno puede eliminarlo.' using errcode = '42501';
  end if;

  -- Deja borrar también lo ya entrenado (normalmente protegido).
  perform set_config('app.internal', '1', true);

  delete from public.trainer_appointments where client_id = p_client;
  delete from public.programs where client_id = p_client;
  delete from public.clients where id = p_client;  -- el resto se borra en cascada

  if c.profile_id is not null then
    begin
      delete from auth.users where id = c.profile_id;   -- borra también su perfil
    exception when others then
      update public.profiles
         set is_active = false, full_name = 'Cuenta eliminada', phone = null
       where id = c.profile_id;
    end;
  end if;
  return true;
end $$;

grant execute on function public.delete_client_fully(uuid) to authenticated;
