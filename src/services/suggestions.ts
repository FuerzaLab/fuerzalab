import { supabase } from "../lib/supabase";
import { listClients, type ClientRow } from "./clients";
import { wellnessScore } from "./wellness";

export type SuggestionType = "no_logs" | "low_adherence" | "stagnation" | "wellness_risk" | "assessment_due" | "payment_overdue";
export type SuggestionSeverity = "info" | "review" | "urgent";

export interface Suggestion {
  clientId: string;
  clientName: string;
  type: SuggestionType;
  severity: SuggestionSeverity;
  title: string;
  detail: string;
}

export const TYPE_LABEL: Record<SuggestionType, string> = {
  no_logs: "Sin entrenamientos recientes",
  low_adherence: "Baja adherencia",
  stagnation: "Estancamiento de fuerza",
  wellness_risk: "Bienestar bajo sostenido",
  assessment_due: "Evaluación vencida",
  payment_overdue: "Pago vencido",
};

const DAY = 86400000;

/**
 * Calcula las alertas en el momento, a partir de los datos reales ya
 * cargados — no se guardan en ninguna tabla aparte, así que siempre
 * reflejan el estado actual. Los umbrales de cada regla son una decisión
 * razonable, no una norma externa; si alguno no encaja con tu forma de
 * trabajar, se puede ajustar.
 */
export async function computeSuggestions(): Promise<Suggestion[]> {
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString();
  const since14Date = since14.slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const clients = await listClients();
  const activeClients = clients.filter((c) => c.status === "active");
  const nameFor = (id: string) => clients.find((c) => c.id === id)?.full_name ?? "Cliente";

  const [{ data: workoutLogs }, { data: wellnessLogs }, { data: overduePayments }, { data: assessments }, { data: strengthTests }] = await Promise.all([
    supabase.from("workout_logs").select("client_id, status, created_at, completed_at").gte("created_at", since14),
    supabase.from("wellness_logs").select("client_id, log_date, sleep_quality, fatigue, energy, stress, soreness").gte("log_date", since14Date),
    supabase.from("payments").select("client_id, due_date, amount, currency").eq("status", "pending").lt("due_date", todayStr),
    supabase.from("assessments").select("id, client_id, assessed_at").order("assessed_at", { ascending: false }),
    supabase.from("strength_tests").select("client_id, exercise_id, assessment_id, estimated_1rm, exercises(name)"),
  ]);

  const out: Suggestion[] = [];

  for (const client of activeClients) {
    const cid = client.id;

    // --- Sin entrenamientos recientes: ningún workout_log en los últimos 10 días ---
    const recentLogs = (workoutLogs ?? []).filter((l) => l.client_id === cid);
    const since10 = new Date(now.getTime() - 10 * DAY);
    const hasRecent = recentLogs.some((l) => new Date(l.created_at) >= since10);
    const startedAWhileAgo = client.start_date ? new Date(client.start_date) < since10 : true;
    if (!hasRecent && startedAWhileAgo) {
      out.push({
        clientId: cid,
        clientName: client.full_name,
        type: "no_logs",
        severity: "review",
        title: TYPE_LABEL.no_logs,
        detail: "No registra ningún entrenamiento en los últimos 10 días.",
      });
    }

    // --- Baja adherencia: de los entrenamientos de los últimos 14 días, menos del 60% completados ---
    const decided = recentLogs.filter((l) => l.status === "completed" || l.status === "skipped");
    if (decided.length >= 3) {
      const completed = decided.filter((l) => l.status === "completed").length;
      const rate = completed / decided.length;
      if (rate < 0.6) {
        out.push({
          clientId: cid,
          clientName: client.full_name,
          type: "low_adherence",
          severity: rate < 0.4 ? "urgent" : "review",
          title: TYPE_LABEL.low_adherence,
          detail: `Completó ${completed} de ${decided.length} entrenamientos programados en los últimos 14 días (${Math.round(rate * 100)}%).`,
        });
      }
    }

    // --- Bienestar bajo sostenido: 3 o más días con Wellness Score < 60 en los últimos 14 días ---
    const wLogs = (wellnessLogs ?? []).filter((l) => l.client_id === cid);
    const badDays = wLogs.filter((l) => wellnessScore(l) < 60).length;
    if (badDays >= 3) {
      out.push({
        clientId: cid,
        clientName: client.full_name,
        type: "wellness_risk",
        severity: badDays >= 5 ? "urgent" : "review",
        title: TYPE_LABEL.wellness_risk,
        detail: `${badDays} días en 🔴 Riesgo en los últimos 14 días.`,
      });
    }

    // --- Evaluación vencida: cliente activo hace más de 60 días, sin evaluación en los últimos 60 días ---
    const clientAssessments = (assessments ?? []).filter((a) => a.client_id === cid);
    const lastAssessment = clientAssessments[0];
    const since60 = new Date(now.getTime() - 60 * DAY);
    const clientOldEnough = client.start_date ? new Date(client.start_date) < since60 : true;
    if (clientOldEnough && (!lastAssessment || new Date(lastAssessment.assessed_at) < since60)) {
      out.push({
        clientId: cid,
        clientName: client.full_name,
        type: "assessment_due",
        severity: "info",
        title: TYPE_LABEL.assessment_due,
        detail: lastAssessment ? `Su última evaluación fue el ${new Date(lastAssessment.assessed_at).toLocaleDateString("es")}.` : "Todavía no tiene ninguna evaluación registrada.",
      });
    }

    // --- Pago vencido ---
    for (const p of (overduePayments ?? []).filter((p) => p.client_id === cid)) {
      const daysLate = Math.round((now.getTime() - new Date(p.due_date).getTime()) / DAY);
      out.push({
        clientId: cid,
        clientName: client.full_name,
        type: "payment_overdue",
        severity: daysLate > 14 ? "urgent" : "review",
        title: TYPE_LABEL.payment_overdue,
        detail: `Vencido hace ${daysLate} día${daysLate === 1 ? "" : "s"} (${p.amount} ${p.currency}).`,
      });
    }

    // --- Estancamiento de fuerza: el 1RM más reciente de un ejercicio no mejoró respecto al anterior ---
    const clientStrength = (strengthTests ?? []).filter((s: any) => s.client_id === cid);
    const byExercise = new Map<string, { date: string; value: number; name: string }[]>();
    for (const s of clientStrength as any[]) {
      const a = clientAssessments.find((a) => a.id === s.assessment_id);
      if (!a) continue;
      const name = s.exercises?.name ?? "";
      if (!byExercise.has(s.exercise_id)) byExercise.set(s.exercise_id, []);
      byExercise.get(s.exercise_id)!.push({ date: a.assessed_at, value: s.estimated_1rm, name });
    }
    for (const [, points] of byExercise) {
      if (points.length < 2) continue;
      points.sort((a, b) => b.date.localeCompare(a.date));
      const [latest, previous] = points;
      if (latest.value <= previous.value) {
        out.push({
          clientId: cid,
          clientName: client.full_name,
          type: "stagnation",
          severity: "info",
          title: TYPE_LABEL.stagnation,
          detail: `${latest.name}: ${previous.value} kg → ${latest.value} kg entre la evaluación anterior y la última.`,
        });
      }
    }
  }

  const severityOrder: Record<SuggestionSeverity, number> = { urgent: 0, review: 1, info: 2 };
  out.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.clientName.localeCompare(b.clientName));
  return out;
}
