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
import { listAssessments } from "../../services/assessments";
import Watermark from "../../components/ui/Watermark";
import InstallAppCard from "../../components/InstallAppCard";
import { getMyTrainerName, getMonthlySessionCounts, listMyRecentRecords, describeRecord, type MyRecord } from "../../services/clientHome";

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
  const [daysSinceMeasurement, setDaysSinceMeasurement] = useState<number | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<{ thisMonth: number; lastMonth: number } | null>(null);
  const [records, setRecords] = useState<MyRecord[]>([]);
  // Bienvenida: se muestra hasta que el alumno la cierra (una vez por cuenta y dispositivo).
  const welcomeKey = `fl-welcome-${profile?.id ?? ""}`;
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(welcomeKey) !== "1";
    } catch {
      return false;
    }
  });
  const closeWelcome = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem(welcomeKey, "1");
    } catch {
      /* nada */
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const cId = await getMyClientId();
        if (!cId) return;
        setClientId(cId);
        // Lo nuevo del Inicio: si falla, el resto se muestra igual.
        getMyTrainerName(cId).then(setTrainerName).catch(() => {});
        getMonthlySessionCounts(cId).then(setMonthly).catch(() => {});
        listMyRecentRecords(cId).then(setRecords).catch(() => {});
        const [session, wellness, messages, payments, clientProfile, dashHighlight, assessments] = await Promise.all([
          getTodaysSessionForClient(cId).catch(() => null),
          getTodayLog(cId).catch(() => null),
          listMessages(cId).catch(() => []),
          listPayments(cId).catch(() => []),
          getClientProfile(cId).catch(() => null),
          getDashboardHighlight(cId).catch(() => ({ bestEver: null, progress: null })),
          listAssessments(cId).catch(() => []),
        ]);
        if (assessments.length === 0) {
          setDaysSinceMeasurement(null); // nunca registró nada — se avisa igual, abajo, sin un número de días
        } else {
          const last = new Date(assessments[0].assessed_at + "T00:00:00");
          const diffDays = Math.floor((Date.now() - last.getTime()) / 86400000);
          setDaysSinceMeasurement(diffDays);
        }
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
      <Watermark />
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name?.split(" ")[0]}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Esto es lo que te toca hoy.</p>

      {showWelcome && (
        <div className="welcome-card">
          <div style={{ fontSize: 28, lineHeight: 1 }}>👋</div>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 17 }}>Te damos la bienvenida a FuerzaLab</b>
            <p style={{ margin: "6px 0 10px" }}>
              {trainerName ? <><b>{trainerName}</b> armó tu plan de entrenamiento.</> : "Tu entrenador armó tu plan de entrenamiento."} Aquí vas a
              encontrar la rutina de cada día, tu progreso y tus récords, y un chat directo con tu entrenador.
            </p>
            <button className="btn" style={{ background: "#fff", color: "var(--nav)" }} onClick={closeWelcome}>¡Empecemos!</button>
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="today-hero">
            <div>
              {todaysSession ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div className="note" style={{ marginBottom: 2 }}>Hoy — {DAY_OF_WEEK_LABEL[new Date().getDay() === 0 ? 7 : new Date().getDay()]}</div>
                    <b className="today-hero-title">{todaysSession.session.name}</b>
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
                    <b className="today-hero-title">{nextSession.session.name}</b>
                  </div>
                  {nextSession.isToday && (
                    <button className="btn" onClick={() => navigate(paths.clientRoutine)}>Entrenar ahora</button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <p className="note">No tienes una rutina asignada para hoy específicamente — revisa tu semana completa cuando quieras.</p>
                  <button className="btn ghost" onClick={() => navigate(paths.clientRoutine)}>Ver mi rutina</button>
                </div>
              )}
            </div>
          </div>

          <InstallAppCard />

          {monthly && (monthly.thisMonth > 0 || monthly.lastMonth > 0) && (
            <div className="panel">
              <div className="bd">
                <b style={{ fontSize: 16 }}>
                  Este mes entrenaste {monthly.thisMonth} {monthly.thisMonth === 1 ? "vez" : "veces"}
                </b>
                <div className="note">
                  {monthly.thisMonth > monthly.lastMonth
                    ? `${monthly.thisMonth - monthly.lastMonth} más que el mes pasado 💪`
                    : monthly.thisMonth === monthly.lastMonth
                      ? "Igual que el mes pasado — ¡sigue así!"
                      : `El mes pasado fueron ${monthly.lastMonth}. ¡Todavía estás a tiempo!`}
                </div>
              </div>
            </div>
          )}

          {records.length > 0 && (
            <div className="panel" style={{ borderLeft: "4px solid var(--ok)" }}>
              <div className="hd"><h3>🏆 Tus récords recientes</h3></div>
              <div className="bd" style={{ display: "grid", gap: 8 }}>
                {records.slice(0, 3).map((r) => (
                  <div key={r.id}>
                    <b>{r.exercise_name}</b>{" "}
                    <span className="note" style={{ fontSize: 12.5 }}>
                      {new Date(r.performed_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    </span>
                    <div className="note" style={{ fontSize: 13 }}>{describeRecord(r)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {(daysSinceMeasurement === null || daysSinceMeasurement >= 15) && (
            <div className="panel">
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <p className="note">
                  {daysSinceMeasurement === null
                    ? "Todavía no registraste tus medidas — prueba cargarlas para empezar a ver tu progreso."
                    : `Pasaron ${daysSinceMeasurement} días desde tu última medición. Es un buen momento para registrar de nuevo.`}
                </p>
                <button className="btn ghost" onClick={() => navigate(paths.clientAssessments)}>Registrar medidas</button>
              </div>
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
                  Tienes {unreadCount} mensaje{unreadCount === 1 ? "" : "s"} sin leer de tu entrenador.
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
