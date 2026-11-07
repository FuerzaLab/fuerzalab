-- =====================================================================
-- SÉPTIMA MIGRACIÓN DE LA PARTE 4 (Bienvenida del entrenador invitado)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Para la pantalla de registro de un entrenador invitado: si su
-- organización está en prueba gratis, cuántos días le quedan y con cuántos
-- alumnos. Solo responde con un código de invitación de entrenador válido
-- (no muestra nada más de la organización).
-- =====================================================================

create or replace function public.invitation_welcome(p_code text)
returns table (trial_days int, trial_free_clients int)
language sql stable security definer set search_path = public as $$
  select
    case when o.trial_ends_at is not null and o.trial_ends_at > now() and not coalesce(o.billing_exempt, false)
         then greatest(1, ceil(extract(epoch from (o.trial_ends_at - now())) / 86400)::int) end,
    case when o.trial_ends_at is not null and o.trial_ends_at > now() and not coalesce(o.billing_exempt, false)
         then o.trial_free_clients end
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.code = upper(btrim(p_code)) and i.status = 'pending' and i.expires_at > now() and i.role = 'trainer'
$$;
grant execute on function public.invitation_welcome(text) to anon, authenticated;
