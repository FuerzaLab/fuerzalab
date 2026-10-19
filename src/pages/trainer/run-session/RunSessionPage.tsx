import { useEffect, useState } from "react";
import { useToast } from "../../../contexts/ToastContext";
import { listClients, type ClientRow } from "../../../services/clients";
import { listWeeks, type ProgramRow, type WeekRow } from "../../../services/programs";
import { listSessions, type SessionRow } from "../../../services/sessions";
import { getActiveProgramForClient, getSessionStatuses, type WorkoutLogRow } from "../../../services/training";
import { TrainSession } from "../../client/Routine";
import Loading from "../../../components/ui/Loading";

const STATUS_LABEL: Record<WorkoutLogRow["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  skipped: "Saltada",
};

export default function RunSessionPage() {
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weekId, setWeekId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkoutLogRow["status"]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = async (wId: string) => {
    const ss = await listSessions(wId);
    setSessions(ss);
    setStatuses(await getSessionStatuses(ss.map((s) => s.id)));
  };

  useEffect(() => {
    if (!clientId) {
      setProgram(null);
      setWeeks([]);
      setSessions([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const prog = await getActiveProgramForClient(clientId);
        setProgram(prog);
        if (prog) {
          const ws = await listWeeks(prog.id);
          setWeeks(ws);
          const firstWeek = ws[0]?.id ?? "";
          setWeekId(firstWeek);
          if (firstWeek) await loadSessions(firstWeek);
        } else {
          setWeeks([]);
          setSessions([]);
        }
      } catch (e: any) {
        notify(e.message);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (weekId) loadSessions(weekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  if (activeSessionId) {
    return (
      <TrainSession
        sessionId={activeSessionId}
        backLabel="Volver"
        onExit={async () => {
          setActiveSessionId(null);
          await loadSessions(weekId);
        }}
      />
    );
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Entrenar con un cliente</h1>
      <p className="note" style={{ marginBottom: 20 }}>
        Para cuando das la asesoría en persona: abrí la rutina de tu cliente vos mismo y cargá las series mientras lo acompañás. Queda guardado en su historial exactamente igual que si lo hubiera cargado él.
      </p>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {!clientId && <p className="note">Elige un cliente para ver su programa activo.</p>}
      {clientId && loading && <Loading />}
      {clientId && !loading && !program && <p className="note">Este cliente todavía no tiene un programa activo.</p>}

      {clientId && !loading && program && (
        <>
          <p className="note" style={{ marginBottom: 14 }}>{program.name}</p>
          {weeks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {weeks.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWeekId(w.id)}
                  className="btn ghost"
                  style={{ padding: "6px 14px", fontSize: 13, background: w.id === weekId ? "var(--pri)" : "transparent", color: w.id === weekId ? "#fff" : "var(--pri)" }}
                >
                  Semana {w.week_number}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((s) => {
              const status = statuses[s.id] ?? "pending";
              return (
                <div key={s.id} className="panel">
                  <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <b>{s.name}</b>
                      <div className="note">{STATUS_LABEL[status]}</div>
                    </div>
                    <button className="btn" onClick={() => setActiveSessionId(s.id)} disabled={status === "completed"}>
                      {status === "completed" ? "Completada" : status === "in_progress" ? "Continuar" : "Entrenar"}
                    </button>
                  </div>
                </div>
              );
            })}
            {sessions.length === 0 && <p className="note">Esta semana todavía no tiene rutinas armadas.</p>}
          </div>
        </>
      )}
    </div>
  );
}
