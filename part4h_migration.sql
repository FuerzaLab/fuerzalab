-- =====================================================================
-- OCTAVA MIGRACIÓN DE LA PARTE 4 (Demo como alumno)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Para el botón "Ver la demo como alumno": conecta la cuenta de alumno de la
-- demo con uno de los alumnos de ejemplo (que se vuelven a crear cada día).
-- Solo lo puede usar un entrenador, sobre un alumno suyo, dentro de una
-- organización "Sin cobro" con "Demo" en el nombre, y solo con una cuenta de
-- alumno de esa misma organización. No sirve para nada fuera de la demo.
-- =====================================================================

create or replace function public.demo_link_client(p_client uuid, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_profile uuid;
begin
  if public.auth_role() <> 'trainer' then return false; end if;
  select c.organization_id into v_org
    from public.clients c
    join public.organizations o on o.id = c.organization_id
   where c.id = p_client and c.trainer_id = auth.uid()
     and o.billing_exempt and o.name ilike '%demo%';
  if v_org is null then return false; end if;

  select p.id into v_profile
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = lower(btrim(p_email)) and p.role = 'client' and p.organization_id = v_org;
  if v_profile is null then return false; end if;

  perform set_config('app.internal', '1', true);
  update public.clients set profile_id = null where profile_id = v_profile and id <> p_client;
  update public.clients set profile_id = v_profile, status = 'active' where id = p_client;
  return true;
end $$;
grant execute on function public.demo_link_client(uuid, text) to authenticated;
