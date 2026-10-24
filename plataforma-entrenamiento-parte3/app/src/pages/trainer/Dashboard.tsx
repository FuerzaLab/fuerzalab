import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { paths } from "../../routes/paths";
import { listClients, type ClientRow } from "../../services/clients";
import { listTodayLogsForTrainer, wellnessScore, wellnessSemaforo, type WellnessLogRow } from "../../services/wellness";
import { computeSuggestions } from "../../services/suggestions";
import { getTodaysSessionForClient, type TodaysSession } from "../../services/sessions";
import Loading from "../../components/ui/Loading";

const SESSION_STATUS_LABEL: Record<TodaysSession["status"], string> = {
  pending: "Todavía no la empezó",
  in_progress: "La está haciendo ahora",
  completed: "Ya la completó",
  skipped: "La saltó",
};

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [todayLogs, setTodayLogs] = useState<WellnessLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionCount, setSuggestionCount] = useState<number | null>(null);
  const [todaysSessions, setTodaysSessions] = useState<TodaysSession[] | null>(null);

  useEffect(() => {
    Promise.all([listClients(), listTodayLogsForTrainer()])
      .then(async ([c, l]) => {
        setClients(c);
        setTodayLogs(l);
        const active = c.filter((x) => x.status === "active");
        const results = await Promise.all(active.map((x) => getTodaysSessionForClient(x.id).catch(() => null)));
        setTodaysSessions(results.filter((r): r is TodaysSession => r != null));
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    computeSuggestions().then((s) => setSuggestionCount(s.length)).catch(() => setSuggestionCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameFor = (clientId: string) => clients.find((c) => c.id === clientId)?.full_name ?? "Cliente";
  const redToday = todayLogs.filter((l) => wellnessScore(l) < 60);
  const yellowToday = todayLogs.filter((l) => { const s = wellnessScore(l); return s >= 60 && s < 80; });

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Esto es lo que pasó hoy con el bienestar de tus clientes.</p>

      {loading ? (
        <Loading />
      ) : (
        <>
          {todaysSessions && todaysSessions.length > 0 && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="hd"><h3>Hoy</h3></div>
              <div className="bd">
                {todaysSessions.map((t) => (
                  <div key={t.session.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <span><b>{nameFor(t.clientId)}</b> — {t.session.name}</span>
                    <Chip tone={t.status === "completed" ? "ok" : t.status === "in_progress" ? "warn" : ""}>{SESSION_STATUS_LABEL[t.status]}</Chip>
                  </div>
                ))}
                <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
                  Solo aparecen acá los clientes cuyo programa tiene fecha de inicio puesta (en Planificación) y una rutina asignada al día de hoy.
                </p>
              </div>
            </div>
          )}

          {(redToday.length > 0 || yellowToday.length > 0) && (
            <div className="panel" style={{ marginBottom: 20, borderLeft: `4px solid ${redToday.length > 0 ? "var(--bad)" : "var(--warn)"}` }}>
              <div className="hd"><h3>Alertas de bienestar — hoy</h3></div>
              <div className="bd">
                {redToday.map((l) => {
                  const semaforo = wellnessSemaforo(wellnessScore(l));
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => navigate(paths.trainerWellness)}>
                      <span><b>{nameFor(l.client_id)}</b> — {semaforo.recommendation}</span>
                      <Chip tone="bad">{semaforo.emoji} {wellnessScore(l)}/100</Chip>
                    </div>
                  );
                })}
                {yellowToday.map((l) => {
                  const semaforo = wellnessSemaforo(wellnessScore(l));
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => navigate(paths.trainerWellness)}>
                      <span>{nameFor(l.client_id)} — {semaforo.recommendation}</span>
                      <Chip tone="warn">{semaforo.emoji} {wellnessScore(l)}/100</Chip>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {redToday.length === 0 && yellowToday.length === 0 && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="bd">
                <p className="note">
                  {todayLogs.length > 0
                    ? "Ningún cliente con alerta de bienestar hoy. 🟢"
                    : "Todavía no hay registros de bienestar hoy — se completan cuando cada cliente inicia su rutina programada."}
                </p>
              </div>
            </div>
          )}
          {suggestionCount !== null && suggestionCount > 0 && (
            <p className="note" style={{ cursor: "pointer" }} onClick={() => navigate(paths.trainerSuggestions)}>
              Hay {suggestionCount} sugerencia{suggestionCount === 1 ? "" : "s"} más esperando — ver Sugerencias.
            </p>
          )}
        </>
      )}
    </div>
  );
}
