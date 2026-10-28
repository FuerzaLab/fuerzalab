-- =====================================================================
-- VIGESIMOSEGUNDA MIGRACIÓN DE LA PARTE 3 (Secciones que usa cada entrenador)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Cada entrenador puede elegir, en Configuración → "Secciones que uso",
-- qué secciones aparecen en su menú (por ejemplo, ocultar Pagos si no
-- cobra por la app, o Equipo si trabaja solo). Esta columna guarda las que
-- ocultó. Vacía (null) = no eligió todavía: se usa el valor por defecto
-- (los entrenadores que ya existían ven todo, como siempre).
--
-- Cada persona ya podía modificar su propio perfil (salvo rol,
-- organización, email y estado), así que no hace falta ninguna regla nueva.
-- Ocultar una sección solo la saca del menú: no borra nada ni bloquea el
-- acceso.
-- =====================================================================

alter table public.profiles
  add column if not exists menu_hidden text[];
