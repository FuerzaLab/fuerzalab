import { useEffect, useMemo, useState } from "react";
import Loading from "../../../components/ui/Loading";
import Chip from "../../../components/ui/Chip";
import { useIsStudioOwner } from "../../../hooks/useIsStudioOwner";
import { getInactiveClients, getStudioStats, type InactiveClient, type TrainerStats } from "../../../services/studio";

/**
 * "Tu estudio" — solo para el dueño del estudio (lo elige el Super Admin
 * en Organizaciones). Resumen del mes por entrenador y alumnos que dejaron
 * de entrenar. Los números llegan ya calculados desde la base de datos:
 * el dueño ve cómo va su equipo sin acceso a las fichas de cada alumno.
 */

function monthStart(offset: number): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
}
const monthLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es", { month: "long", year: "numeric" });
const money = (n: number, cur: string | null) => `${cur ?? ""} ${Math.round(n).toLocaleString("es")}`.trim();

function adherence(t: Pick<TrainerStats, "workouts_completed" | "sessions_scheduled">): number | null {
  if (!t.sessions_scheduled) return null;
  return Math.min(100, Math.round((t.workouts_completed / t.sessions_scheduled) * 100));
}

function lastSeen(iso: string | null): string {
  if (!iso) return "Nunca entró";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Entró hoy";
  if (days === 1) return "Entró ayer";
  return `Entró hace ${days} días`;
}

export default function StudioPage() {
  const isOwner = useIsStudioOwner();
  const [offset, setOffset] = useState(0); // 0 = este mes, -1 = el anterior
  const [stats, setStats] = useState<TrainerStats[] | null>(null);
  const [inactive, setInactive] = useState<InactiveClient[] | null>(null);
  const [days, setDays] = useState(10);
  const [error, setError] = useState("");

  const start = monthStart(offset);

  useEffect(() => {
    if (!isOwner) return;
    setStats(null);
    setError("");
    getStudioStats(start)
      .then(setStats)
      .catch((e: any) => {
        setError(e.message);
        setStats([]);
      });
  }, [isOwner, start]);

  useEffect(() => {
    if (!isOwner) return;
    setInactive(null);
    getInactiveClients(days)
      .then(setInactive)
      .catch(() => setInactive([]));
  }, [isOwner, days]);

  const totals = useMemo(() => {
    const t = stats ?? [];
    const sum = (k: keyof TrainerStats) => t.reduce((a, x) => a + Number(x[k] ?? 0), 0);
    const cur = t.find((x) => x.currency)?.currency ?? null;
    return {
      trainers: t.length,
      active: sum("clients_active"),
      completed: sum("workouts_completed"),
      scheduled: sum("sessions_scheduled"),
      paid: sum("paid_amount"),
      pending: sum("pending_amount"),
      overdue: sum("overdue_amount"),
      red: sum("wellness_red_7d"),
      cur,
    };
  }, [stats]);

  if (!isOwner) {
    return (
      <div className="page">
        <h1>Tu estudio</h1>
        <div className="panel" style={{ maxWidth: 560 }}>
          <div className="bd">
            <p className="note" style={{ margin: 0 }}>
              Esta pantalla es para el dueño del estudio: muestra cómo va todo el equipo de entrenadores. Si eres el dueño,
              pídele al administrador de FuerzaLab que te marque como tal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const overallAdh = adherence({ workouts_completed: totals.completed, sessions_scheduled: totals.scheduled });

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Tu estudio</h1>
          <p className="note" style={{ margin: "4px 0 0" }}>Cómo va tu equipo en {monthLabel(start)}.</p>
        </div>
        <div role="tablist" style={{ display: "inline-flex", gap: 4, padding: 4, background: "#fff", border: "1px solid var(--line)", borderRadius: 10 }}>
          {[0, -1].map((o) => (
            <button
              key={o}
              role="tab"
              aria-selected={offset === o}
              className={`btn ${offset === o ? "" : "ghost"}`}
              style={{ padding: "6px 12px", fontSize: 13.5, border: offset === o ? undefined : 0 }}
              onClick={() => setOffset(o)}
            >
              {o === 0 ? "Este mes" : "Mes pasado"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {stats === null ? (
        <Loading />
      ) : (
        <>
          <div className="today-hero" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <div className="hero-num">{totals.active}</div>
                <div className="note">alumnos activos · {totals.trainers} entrenadores</div>
              </div>
              <div>
                <div className="hero-num">{overallAdh == null ? "–" : `${overallAdh}%`}</div>
                <div className="note">
                  adherencia ({totals.completed} de {totals.scheduled} rutinas programadas)
                </div>
              </div>
              <div>
                <div className="hero-num">{money(totals.paid, totals.cur)}</div>
                <div className="note">cobrado en el mes</div>
              </div>
              <div>
                <div className="hero-num">{money(totals.overdue, totals.cur)}</div>
                <div className="note">vencido sin cobrar · {money(totals.pending, totals.cur)} por vencer</div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="hd"><h3>Por entrenador</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5, minWidth: 820 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                    <th style={{ padding: "10px 16px" }}>Entrenador</th>
                    <th style={{ padding: "10px 12px" }}>Alumnos</th>
                    <th style={{ padding: "10px 12px" }} title="Rutinas completadas sobre las programadas hasta hoy">Adherencia</th>
                    <th style={{ padding: "10px 12px" }}>Evaluaciones</th>
                    <th style={{ padding: "10px 12px" }} title="Cuestionarios en rojo en los últimos 7 días">Bienestar</th>
                    <th style={{ padding: "10px 12px" }}>Cobrado</th>
                    <th style={{ padding: "10px 16px" }}>Vencido</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((t) => {
                    const adh = adherence(t);
                    return (
                      <tr key={t.trainer_id} style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }}>
                        <td style={{ padding: "11px 16px" }}>
                          <b>{t.full_name || t.email}</b> {!t.is_active && <Chip tone="bad">Desactivado</Chip>}
                          <div className="note" style={{ fontSize: 12.5 }}>{lastSeen(t.last_sign_in_at)}</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <b>{t.clients_active}</b> activos
                          {(t.clients_paused > 0 || t.clients_prospect > 0) && (
                            <div className="note" style={{ fontSize: 12.5 }}>
                              {[t.clients_paused ? `${t.clients_paused} en pausa` : "", t.clients_prospect ? `${t.clients_prospect} sin aceptar` : ""].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          {adh == null ? (
                            <span className="note">Sin rutinas programadas</span>
                          ) : (
                            <>
                              <b style={{ color: adh >= 80 ? "var(--ok)" : adh >= 60 ? "var(--warn)" : "var(--bad)" }}>{adh}%</b>
                              <div className="note" style={{ fontSize: 12.5 }}>
                                {t.workouts_completed} de {t.sessions_scheduled}
                                {t.workouts_skipped ? ` · ${t.workouts_skipped} saltadas` : ""}
                              </div>
                            </>
                          )}
                        </td>
                        <td style={{ padding: "11px 12px" }}>{t.assessments}</td>
                        <td style={{ padding: "11px 12px" }}>
                          {t.wellness_red_7d > 0 ? <Chip tone="bad">{t.wellness_red_7d} en rojo</Chip> : <span className="note">Sin alertas</span>}
                          <div className="note" style={{ fontSize: 12.5 }}>{t.wellness_logs} registros en el mes</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          {money(t.paid_amount, t.currency)}
                          {t.pending_amount > 0 && <div className="note" style={{ fontSize: 12.5 }}>{money(t.pending_amount, t.currency)} por vencer</div>}
                        </td>
                        <td style={{ padding: "11px 16px", color: t.overdue_amount > 0 ? "var(--bad)" : undefined, fontWeight: t.overdue_amount > 0 ? 600 : undefined }}>
                          {t.overdue_amount > 0 ? money(t.overdue_amount, t.currency) : <span className="note">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {stats.length === 0 && (
                    <tr>
                      <td colSpan={7} className="note" style={{ padding: 16 }}>Todavía no hay entrenadores en tu estudio.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="note" style={{ fontSize: 12.5, margin: 0, padding: "10px 16px 14px", borderTop: "1px solid var(--line)" }}>
              La adherencia compara las rutinas completadas con las programadas hasta hoy (en programas con fecha de inicio).
              Cobrado y vencido incluyen todas las monedas sumadas como una sola.
            </p>
          </div>

          <div className="panel">
            <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
              <h3>Alumnos que dejaron de entrenar</h3>
              <label className="note" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                Sin entrenar hace
                <select className="input" style={{ width: "auto", padding: "4px 8px", fontSize: 13 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {[7, 10, 14, 21, 30].map((d) => (
                    <option key={d} value={d}>{d} días o más</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="bd">
              {inactive === null ? (
                <Loading />
              ) : inactive.length === 0 ? (
                <p className="note" style={{ margin: 0 }}>Todos los alumnos activos entrenaron en los últimos {days} días. ✓</p>
              ) : (
                <div style={{ display: "grid", gap: 0 }}>
                  {inactive.map((c, i) => (
                    <div key={c.client_id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: i ? "1px solid var(--line)" : undefined, flexWrap: "wrap" }}>
                      <div>
                        <b>{c.client_name}</b>
                        <div className="note" style={{ fontSize: 12.5 }}>Entrenador: {c.trainer_name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Chip tone={c.days_inactive >= 21 ? "bad" : "warn"}>{c.days_inactive} días</Chip>
                        <div className="note" style={{ fontSize: 12.5 }}>
                          {c.last_workout_at ? `Último: ${new Date(c.last_workout_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}` : "Nunca completó una rutina"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
