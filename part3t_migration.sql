-- =====================================================================
-- DECIMONOVENA MIGRACIÓN DE LA PARTE 3 (Planes en la página de presentación)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- La página de presentación (fuerzala.netlify.app sin iniciar sesión)
-- muestra los planes de FuerzaLab con su precio. Esos planes ya los
-- manejas como Super Admin en "Pagos de la plataforma". Esta función deja
-- leer SOLO los planes activos y SOLO su nombre, límites y precio, a
-- cualquiera (sin iniciar sesión) — nada de organizaciones, suscripciones
-- ni pagos. Así, si cambias un precio, la página se actualiza sola.
-- =====================================================================

create or replace function public.public_platform_plans()
returns table (name text, client_limit int, trainer_limit int, price numeric, currency text, billing_period text)
language sql stable security definer set search_path = public as $$
  select name, client_limit, trainer_limit, price, currency, billing_period
  from public.platform_plans
  where is_active
  order by price, name
$$;

grant execute on function public.public_platform_plans() to anon, authenticated;
