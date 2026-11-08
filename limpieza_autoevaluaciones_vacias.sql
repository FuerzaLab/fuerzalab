-- =====================================================================
-- LIMPIEZA (una sola vez): autoevaluaciones vacías
-- No es una migración: no cambia la estructura, solo borra datos basura.
--
-- Por un error al guardar (peso escrito con coma, por ejemplo "82,15"),
-- algunas autoevaluaciones de alumnos quedaron creadas SIN ningún dato.
-- Este script las encuentra y las borra. Solo toca autoevaluaciones
-- ('self_report') que no tienen peso, medidas, pliegues ni pruebas de fuerza.
--
-- PASO 1: corre solo el SELECT para ver cuáles son.
-- PASO 2: si la lista es correcta, corre el DELETE.
-- =====================================================================

-- PASO 1: ver cuáles se van a borrar
select a.id, c.full_name as alumno, a.assessed_at, a.created_at
from public.assessments a
join public.clients c on c.id = a.client_id
where a.type = 'self_report'
  and not exists (select 1 from public.body_measurements b where b.assessment_id = a.id)
  and not exists (select 1 from public.circumferences x where x.assessment_id = a.id)
  and not exists (select 1 from public.skinfolds s where s.assessment_id = a.id)
  and not exists (select 1 from public.strength_tests t where t.assessment_id = a.id)
order by c.full_name, a.created_at;

-- PASO 2: borrarlas (descomenta las líneas de abajo, quitando los "--", y córrelas)
-- delete from public.assessments a
-- where a.type = 'self_report'
--   and not exists (select 1 from public.body_measurements b where b.assessment_id = a.id)
--   and not exists (select 1 from public.circumferences x where x.assessment_id = a.id)
--   and not exists (select 1 from public.skinfolds s where s.assessment_id = a.id)
--   and not exists (select 1 from public.strength_tests t where t.assessment_id = a.id);
