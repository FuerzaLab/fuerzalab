import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import Loading from "../../components/ui/Loading";
import { PhotoBeforeAfter } from "../../components/reports/ReportSections";
import { paths } from "../../routes/paths";
import { getMyClientId, getClientProfile } from "../../services/clients";
import {
  getTodaysSessionForClient,
  getNextScheduledSessionForClient,
  DAY_OF_WEEK_LABEL,
  type TodaysSession,
  type NextSession,
} from "../../services/sessions";
import { getTodayLog } from "../../services/wellness";
import { listMessages } from "../../services/messages";
import { listPayments, type PaymentRow } from "../../services/payments";
import { getDashboardHighlight, type DashboardHighlight } from "../../services/reports";

const SESSION_STATUS_LABEL: Record<TodaysSession["status"], string> = {
  pending: "Todavía no la empezaste",
  in_progress: "La estás haciendo",
  completed: "Ya la completaste",
  skipped: "La saltaste",
};

export default function ClientDashboard() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [todaysSession, setTodaysSession] = useState<TodaysSession | null>(null);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [wellnessDoneToday, setWellnessDoneToday] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextPayment, setNextPayment] = useState<PaymentRow | null>(null);
  const [mainGoal, setMainGoal] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<DashboardHighlight | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cId = await getMyClientId();
        if (!cId) return;
        setClientId(cId);
        const [session, wellness, messages, payments, clientProfile, dashHighlight] = await Promise.all([
          getTodaysSessionForClient(cId).catch(() => null),
          getTodayLog(cId).catch(() => null),
          listMessages(cId).catch(() => []),
          listPayments(cId).catch(() => []),
          getClientProfile(cId).catch(() => null),
          getDashboardHighlight(cId).catch(() => ({ bestEver: null, progress: null })),
        ]);
        setTodaysSession(session);
        setWellnessDoneToday(!!wellness);
        setUnreadCount(messages.filter((m) => m.sender_id !== profile?.id && !m.read_at).length);
        const pending = payments.filter((p) => p.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date));
        setNextPayment(pending[0] ?? null);
        setMainGoal(clientProfile?.main_goal ?? null);
        setHighlight(dashHighlight);
        if (!session) {
          const next = await getNextScheduledSessionForClient(cId).catch(() => null);
          setNextSession(next);
        }
      } catch (e: any) {
        notify(e.message);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const paymentOverdue = nextPayment && nextPayment.due_date < today;
  const hasHighlight = highlight && (highlight.bestEver || highlight.progress || mainGoal);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Esto es lo que te toca hoy.</p>

      {loading ? (
        <Loading />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="panel">
            <div className="bd">
              {todaysSession ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div className="note" style={{ marginBottom: 2 }}>Hoy — {DAY_OF_WEEK_LABEL[new Date().getDay() === 0 ? 7 : new Date().getDay()]}</div>
                    <b style={{ fontSize: 17 }}>{todaysSession.session.name}</b>
                    <div className="note">{SESSION_STATUS_LABEL[todaysSession.status]}</div>
                  </div>
                  {todaysSession.status !== "completed" && (
                    <button className="btn" onClick={() => navigate(paths.clientRoutine)}>
                      {todaysSession.status === "in_progress" ? "Continuar" : "Entrenar ahora"}
                    </button>
                  )}
                </div>
              ) : nextSession ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div className="note" style={{ marginBottom: 2 }}>{nextSession.isToday ? "Hoy" : `Tu próxima rutina — ${nextSession.dayLabel}`}</div>
                    <b style={{ fontSize: 17 }}>{nextSession.session.name}</b>
                  </div>
                  {nextSession.isToday && (
                    <button className="btn" onClick={() => navigate(paths.clientRoutine)}>Entrenar ahora</button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <p className="note">No tenés una rutina asignada para hoy específicamente — revisá tu semana completa cuando quieras.</p>
                  <button className="btn ghost" onClick={() => navigate(paths.clientRoutine)}>Ver mi rutina</button>
                </div>
              )}
            </div>
          </div>

          {hasHighlight && (
            <div className="panel">
              <div className="bd" style={{ display: "grid", gap: 8 }}>
                {mainGoal && <p style={{ margin: 0 }}><span className="note">Tu objetivo: </span>{mainGoal}</p>}
                {highlight?.bestEver && (
                  <p style={{ margin: 0 }}>
                    <span className="note">Tu mejor marca: </span>
                    <b>{highlight.bestEver.exerciseName} {highlight.bestEver.loadKg} kg</b>
                  </p>
                )}
                {highlight?.progress && (
                  <p style={{ margin: 0 }}>
                    <span className="note">Progreso en {highlight.progress.exerciseName}: </span>
                    <b style={{ color: "var(--ok)" }}>{highlight.progress.fromKg} kg → {highlight.progress.toKg} kg</b>
                  </p>
                )}
              </div>
            </div>
          )}

          {clientId && (
            <div className="panel">
              <div className="hd"><h3>Tu progreso en fotos</h3></div>
              <div className="bd"><PhotoBeforeAfter clientId={clientId} restrictToShared={true} /></div>
            </div>
          )}

          {!wellnessDoneToday && (
            <div className="panel" style={{ borderLeft: "4px solid var(--wellness)" }}>
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <p className="note">Todavía no completaste tu registro de bienestar de hoy.</p>
                <button className="btn ghost" onClick={() => navigate(paths.clientWellness)}>Completar</button>
              </div>
            </div>
          )}

          {nextPayment && (
            <div className="panel" style={paymentOverdue ? { borderLeft: "4px solid var(--bad)" } : undefined}>
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span className="note">{paymentOverdue ? "Pago vencido" : "Próximo pago"} — </span>
                  {nextPayment.currency} {nextPayment.amount} · vence {new Date(nextPayment.due_date).toLocaleDateString("es")}
                  {paymentOverdue && <Chip tone="bad">Vencido</Chip>}
                </div>
                <button className="btn ghost" onClick={() => navigate(paths.clientPayments)}>Ver pagos</button>
              </div>
            </div>
          )}

          {unreadCount > 0 && (
            <div className="panel">
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <p className="note">
                  Tenés {unreadCount} mensaje{unreadCount === 1 ? "" : "s"} sin leer de tu entrenador.
                </p>
                <button className="btn ghost" onClick={() => navigate(paths.clientMessages)}>Ver mensajes</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
