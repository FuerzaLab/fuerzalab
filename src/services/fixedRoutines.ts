import { supabase } from "../lib/supabase";
import { createSession, listSessions, updateSessionDay, type SessionRow } from "./sessions";
import { createWeek, listWeeks, updateWeekStartDate } from "./programs";
import { listDoneSessions } from "./sessions";

/**
 * "Rutinas fijas" (part4d_migration.sql): para entrenadores que no
 * planifican por semanas. Por dentro es un programa con semanas, pero las
 * crea y copia la base de datos: el entrenador solo ve los días (Día A, B…).
 * Un cambio se copia solo a las próximas veces de ese día que no se hicieron.
 */

/** Lunes de esta semana, AAAA-MM-DD (hora local). */
function mondayOfThisWeek(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

export async function createFixedProgram(params: { organizationId: string; trainerId: string; clientId: string; clientName: string }): Promise<string> {
  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      name: `Rutinas de ${params.clientName.split(" ")[0]}`,
      method: "simple",
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: modeErr } = await supabase.from("programs").update({ plan_mode: "fixed" }).eq("id", program.id);
  if (modeErr) {
    await supabase.from("programs").delete().eq("id", program.id);
    throw new Error(/plan_mode/.test(modeErr.message) ? "Falta correr part4d_migration.sql en Supabase." : modeErr.message);
  }
  const week = await createWeek(program.id, 1);
  await updateWeekStartDate(week.id, mondayOfThisWeek());
  const day = await createSession(week.id, "Día A", 0);
  await updateSessionDay(day.id, 1);
  await extendFixedProgram(program.id);
  return program.id as string;
}

export async function extendFixedProgram(programId: string): Promise<void> {
  await supabase.rpc("fixed_extend", { p_program: programId, p_weeks_ahead: 8 });
}

export async function addFixedDay(programId: string, name: string, dayOfWeek: number): Promise<void> {
  const { error } = await supabase.rpc("fixed_add_day", { p_program: programId, p_name: name, p_day: dayOfWeek });
  if (error) throw error;
}

export async function deleteFixedDay(programId: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.rpc("fixed_delete_day", { p_program: programId, p_sort: sortOrder });
  if (error) throw error;
}

export async function setPlanMode(programId: string, mode: "fixed" | "weekly"): Promise<void> {
  const { error } = await supabase.from("programs").update({ plan_mode: mode }).eq("id", programId);
  if (error) throw error;
}

/**
 * Los días de una rutina fija, cada uno con su "próxima vez": la primera vez,
 * desde esta semana, que todavía no se hizo. Esa es la que se edita en el
 * Constructor (y el cambio se copia solo a las siguientes).
 */
export async function listFixedSlots(programId: string): Promise<SessionRow[]> {
  const weeks = await listWeeks(programId);
  const week1 = weeks.find((w) => w.week_number === 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cur = week1?.start_date ? Math.max(1, Math.floor((today.getTime() - new Date(week1.start_date + "T00:00:00").getTime()) / 86400000 / 7) + 1) : 1;
  const upcoming = weeks.filter((w) => w.week_number >= cur).sort((a, b) => a.week_number - b.week_number);
  const bySlot = new Map<number, SessionRow>();
  for (const w of upcoming) {
    const ss = await listSessions(w.id);
    const done = await listDoneSessions(ss.map((s) => s.id));
    for (const s of ss) {
      if (bySlot.has(s.sort_order) || done[s.id] !== undefined) continue;
      // Esta semana, un día que ya pasó sin hacerse no cuenta como "próxima vez".
      if (w.week_number === cur && s.day_of_week && week1?.start_date) {
        const date = new Date(week1.start_date + "T00:00:00");
        date.setDate(date.getDate() + (w.week_number - 1) * 7 + (s.day_of_week - 1));
        if (date < today) continue;
      }
      bySlot.set(s.sort_order, s);
    }
    if (bySlot.size && upcoming.indexOf(w) >= 1) {
      // Con dos semanas revisadas ya están todos los días.
      const allSorts = new Set(ss.map((s) => s.sort_order));
      if ([...allSorts].every((k) => bySlot.has(k))) break;
    }
  }
  return [...bySlot.values()].sort((a, b) => a.sort_order - b.sort_order);
}
