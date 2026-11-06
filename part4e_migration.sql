-- =====================================================================
-- QUINTA MIGRACIÓN DE LA PARTE 4 (El dueño del estudio invita entrenadores)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere haber corrido antes part3u (dueño del estudio) y part3y (planes).
--
--  * El entrenador que es DUEÑO de su organización (organizations.owner_id)
--    puede invitar entrenadores a su propio estudio. Antes, solo el Super Admin.
--  * Límite de entrenadores del plan (platform_plans.trainer_limit): al
--    invitar se cuentan los entrenadores que ya tiene y las invitaciones a
--    entrenadores que siguen sin usar. Si se pasa, no deja invitar. Las
--    organizaciones "Sin cobro" y el Super Admin no tienen este límite.
-- =====================================================================

drop policy if exists p_insert on public.invitations;
create policy p_insert on public.invitations for insert to authenticated
  with check (
    (public.is_super_admin() and invited_by = auth.uid())
    or (public.auth_role() = 'trainer'
        and role in ('client','staff')
        and organization_id = public.auth_org()
        and trainer_id = auth.uid()
        and invited_by = auth.uid()
        and (client_id is null or exists (select 1 from public.clients c
                                          where c.id = client_id and c.trainer_id = auth.uid())))
    -- El dueño del estudio invita entrenadores a su propia organización.
    or (public.auth_role() = 'trainer'
        and role = 'trainer'
        and organization_id = public.auth_org()
        and invited_by = auth.uid()
        and client_id is null
        and exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid()))
  );

create or replace function public.invitations_trainer_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org public.organizations%rowtype;
  v_limit int;
  v_count int;
begin
  if new.role <> 'trainer' or public.is_super_admin() then return new; end if;
  select * into v_org from public.organizations where id = new.organization_id;
  if v_org.billing_exempt then return new; end if;
  select p.trainer_limit into v_limit from public.platform_plans p where p.id = v_org.plan_id;
  if v_limit is null then return new; end if;
  select (select count(*) from public.profiles pr where pr.organization_id = new.organization_id and pr.role = 'trainer' and pr.is_active)
       + (select count(*) from public.invitations i where i.organization_id = new.organization_id and i.role = 'trainer' and i.status = 'pending')
    into v_count;
  if v_count >= v_limit then
    raise exception 'Tu plan permite hasta % entrenadores (contando las invitaciones sin usar). Para sumar más, escríbenos para cambiar de plan.', v_limit
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists b_trainer_limit on public.invitations;
create trigger b_trainer_limit before insert on public.invitations
  for each row execute function public.invitations_trainer_limit();
