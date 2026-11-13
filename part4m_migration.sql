-- =====================================================================
-- DECIMOTERCERA MIGRACIÓN DE LA PARTE 4 (Músculos secundarios)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Para contar el volumen como el metaanálisis de Pelland y cols. (Sports
-- Medicine, 2026): cada serie cuenta 1 para el músculo principal del
-- ejercicio y 0,5 para cada músculo secundario (conteo "fraccional").
--
--  * exercises.secondary_muscle_ids: los músculos secundarios (grupos del
--    catálogo). NULL = todavía sin definir; '{}' = ninguno, a propósito.
--  * Una regla los propone según el nombre y el músculo principal (por
--    ejemplo: un "press" de pecho → tríceps y hombros; un "remo" o una
--    "dominada" → bíceps; una "sentadilla" → glúteos). Se aplica a los
--    ejercicios que ya existen y a los nuevos, solo si no están definidos.
--    Cada entrenador los puede corregir en el ejercicio.
-- =====================================================================

alter table public.exercises add column if not exists secondary_muscle_ids uuid[];
-- NULL significa "todavía sin definir" (la regla de abajo los completa).
alter table public.exercises alter column secondary_muscle_ids drop not null;
alter table public.exercises alter column secondary_muscle_ids drop default;

create or replace function public.fl_norm(p text) returns text
language sql immutable as $$
  select lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
$$;

create or replace function public.infer_secondary_muscles(p_name text, p_primary uuid) returns uuid[]
language plpgsql stable set search_path = public as $$
declare
  n text := public.fl_norm(p_name);
  pk text;
  keys text[] := '{}';
begin
  select key into pk from public.catalog_items where id = p_primary;
  if pk is null then return '{}'; end if;

  -- Peso muerto convencional / sumo (cualquiera sea el principal): glúteos, isquios y espalda.
  if n like '%peso muerto%' and n not like '%rumano%' and n not like '%piernas rigidas%' then
    keys := array['gluteos', 'isquiotibiales', 'espalda'];
  elsif pk = 'pecho' then
    if n ~ '(press|flexion|fondo|push|lagartija)' then keys := array['triceps', 'hombros']; end if;
  elsif pk = 'espalda' then
    if n ~ '(remo|row)' then keys := array['biceps', 'hombros'];
    elsif n ~ '(jalon|dominada|traccion|pull|chin)' and n !~ '(pullover|pull over|face pull)' then keys := array['biceps']; end if;
    if n ~ '(face pull)' then keys := array['hombros']; end if;
  elsif pk = 'hombros' then
    if n ~ '(press|militar|arnold|push press)' then keys := array['triceps']; end if;
    if n ~ '(face pull|pajaro|posterior|reverse fly|vuelos posteriores)' then keys := array['espalda']; end if;
  elsif pk = 'triceps' then
    if n ~ '(press cerrado|agarre cerrado|fondo|flexion|lagartija)' then keys := array['pecho', 'hombros']; end if;
  elsif pk = 'cuadriceps' then
    if n ~ '(sentadilla|squat|prensa|zancada|estocada|lunge|split|bulgara|step|subida|hack|pistol|thruster)' then keys := array['gluteos']; end if;
  elsif pk = 'gluteos' then
    if n ~ '(hip thrust|empuje de cadera|puente|bridge|swing|rumano|buenos dias|good morning)' then keys := array['isquiotibiales']; end if;
    if n ~ '(sentadilla|squat|prensa|zancada|estocada|lunge|split|bulgara|step|subida)' then keys := array['cuadriceps']; end if;
  elsif pk = 'isquiotibiales' then
    if n ~ '(rumano|piernas rigidas|buenos dias|good morning|bisagra|hiperextension|swing|nordic|nordico)' and n !~ '(nordic|nordico)' then
      keys := array['gluteos'];
    end if;
  end if;

  -- Nunca el principal como secundario.
  keys := array_remove(keys, pk);
  return coalesce((
    select array_agg(ci.id order by array_position(keys, ci.key))
      from public.catalog_items ci
     where ci.kind = 'muscle_group' and ci.organization_id is null and ci.key = any(keys)
  ), '{}');
end $$;

create or replace function public.exercises_fill_secondary() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.secondary_muscle_ids is null then
    new.secondary_muscle_ids := public.infer_secondary_muscles(new.name, new.primary_muscle_id);
  end if;
  return new;
end $$;

drop trigger if exists b_fill_secondary on public.exercises;
create trigger b_fill_secondary before insert or update of name, primary_muscle_id, secondary_muscle_ids on public.exercises
  for each row execute function public.exercises_fill_secondary();

-- Los que ya existen (todavía sin definir).
update public.exercises
   set secondary_muscle_ids = public.infer_secondary_muscles(name, primary_muscle_id)
 where secondary_muscle_ids is null;
