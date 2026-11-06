import { supabase } from "../lib/supabase";
import { createSession, listSessions, updateSessionDay, type SessionRow } from "./sessions";
import { createWeek, listWeeks } from "./programs";
import { getActiveProgramForClient } from "./training";
import { applyTemplateDayToWeek } from "./templates";

/**
 * Sala · "Misma rutina para todos" (clase grupal). A cada alumno se le crea
 * para hoy una rutina con el mismo contenido —de una plantilla o copiada de la
 * rutina de otro alumno— y cada uno registra sus propias cargas.
 *
 * Dónde queda esa rutina:
 *  - Si tiene un programa activo, en su semana actual (o, si el programa no
 *    tiene fechas, en su primera semana con rutinas pendientes o la última).
 *  - Si no tiene, en un programa "Clases grupales" archivado (no aparece como
 *    su programa activo ni en "Mi rutina"; sí en su historial, reportes y récords).
 */

const GROUP_PROGRAM_NAME = "Clases grupales";

export type GroupSource =
  | { kind: "template"; templateSessionId: string; name: string }
  | { kind: "session"; sessionId: string; name: string };

async function targetWeekId(params: { clientId: string; organizationId: string; trainerId: string }): Promise<string> {
  const program = await getActiveProgramForClient(params.clientId);
  if (program) {
    const weeks = (await listWeeks(program.id)).sort((a, b) => a.week_number - b.week_number);
    const w1 = weeks.find((w) => w.week_number === 1);
    if (w1?.start_date) {
      const days = Math.floor((Date.now() - new Date(w1.start_date + "T00:00:00").getTime()) / 86400000);
      const cur = weeks.find((w) => w.week_number === Math.floor(days / 7) + 1);
      if (cur) return cur.id;
    }
    if (weeks.length) return weeks[weeks.length - 1].id;
    return (await createWeek(program.id, 1)).id;
  }
  // Sin programa activo: su programa de clases grupales (archivado), con una sola semana.
  const { data: existing } = await supabase
    .from("programs")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("name", GROUP_PROGRAM_NAME)
    .eq("is_template", false)
    .limit(1)
    .maybeSingle();
  let programId = existing?.id as string | undefined;
  if (!programId) {
    const { data, error } = await supabase
      .from("programs")
      .insert({
        organization_id: params.organizationId,
        trainer_id: params.trainerId,
        client_id: params.clientId,
        name: GROUP_PROGRAM_NAME,
        method: "simple",
        status: "archived",
      })
      .select("id")
      .single();
    if (error) throw error;
    programId = data.id as string;
  }
  const weeks = await listWeeks(programId);
  return weeks[0]?.id ?? (await createWeek(programId, 1)).id;
}

/** Crea para hoy, a un alumno, la rutina de la clase grupal. */
export async function createGroupSession(params: {
  clientId: string;
  organizationId: string;
  trainerId: string;
  source: GroupSource;
  name: string;
}): Promise<SessionRow> {
  const weekId = await targetWeekId(params);
  const existing = await listSessions(weekId);
  const sortOrder = existing.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;
  let session: SessionRow;
  if (params.source.kind === "template") {
    session = await applyTemplateDayToWeek({
      templateSessionId: params.source.templateSessionId,
      templateSessionName: params.name,
      targetWeekId: weekId,
      sortOrder,
    });
  } else {
    session = await createSession(weekId, params.name, sortOrder);
    // Copia el contenido (función de la base de datos de part4d_migration.sql).
    const { error } = await supabase.rpc("fixed_copy_session_content", { p_from: params.source.sessionId, p_to: session.id });
    if (error) {
      await supabase.from("sessions").delete().eq("id", session.id);
      throw new Error(/fixed_copy_session_content/.test(error.message) ? "Falta correr part4d_migration.sql en Supabase." : error.message);
    }
  }
  // Para hoy (así el alumno también la ve como "la de hoy" si la abre).
  const dow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  await updateSessionDay(session.id, dow).catch(() => {});
  return { ...session, day_of_week: dow };
}
