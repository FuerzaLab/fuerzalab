-- =====================================================================
-- DÉCIMA MIGRACIÓN DE LA PARTE 3 (Periodicidad quincenal en Pagos de la
-- plataforma, para períodos de prueba gratuitos)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Solo cambia la regla de qué valores acepta una columna que ya existe
-- (platform_plans.billing_period). No borra ni modifica ningún plan que
-- ya hayas creado.
-- =====================================================================

alter table public.platform_plans
  drop constraint if exists platform_plans_billing_period_check;

alter table public.platform_plans
  add constraint platform_plans_billing_period_check
  check (billing_period in ('biweekly', 'monthly', 'quarterly', 'annual'));
