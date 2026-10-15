import { useEffect, useMemo, useState } from "react";
import { Check, ArrowLeft } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { getMyClientId } from "../../services/clients";
import { listWeeks, type ProgramRow, type WeekRow } from "../../services/programs";
import {
  listSessions,
  listSessionBlocks,
  listWorkoutExercises,
  BLOCK_LABEL,
  BLOCK_ORDER,
  type SessionRow,
  type SessionBlockRow,
  type WorkoutExerciseRow,
} from "../../services/sessions";
import {
  getActiveProgramForClient,
  getOrCreateWorkoutLog,
  listSetLogs,
  upsertSetLog,
  completeWorkout,
  getSessionStatuses,
  type WorkoutLogRow,
  type SetLogRow,
} from "../../services/training";
import { getTodayLog } from "../../services/wellness";
import WellnessForm from "../../components/WellnessForm";

const STATUS_LABEL: Record<WorkoutLogRow["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  skipped: "Saltada",
};

export default function ClientRoutine() {
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weekId, setWeekId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkoutLogRow["status"]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const startSession = async (sessionId: string) => {
    if (!clientId) return;
    try {
      const today = await getTodayLog(clientId);
      if (today) setActiveSessionId(sessionId);
      else setPendingSessionId(sessionId);
    } catch (e: any) {
      notify(e.message);
    }
  };

  const loadSessions = async (wId: string) => {
    const ss = await listSessions(wId);
    setSessions(ss);
    setStatuses(await getSessionStatuses(ss.map((s) => s.id)));
  };

  const init = async () => {
    setLoading(true);
    try {
      const cId = await getMyClientId();
      setClientId(cId);
      if (!cId) {
        setLoading(false);
        return;
      }
      const prog = await getActiveProgramForClient(cId);
      setProgram(prog);
      if (prog) {
        const ws = await listWeeks(prog.id);
        setWeeks(ws);
        const firstWeek = ws[0]?.id ?? "";
        setWeekId(firstWeek);
        if (firstWeek) await loadSessions(firstWeek);
      }
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (weekId) loadSessions(weekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  if (pendingSessionId && clientId) {
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <h1 style={{ marginBottom: 4 }}>Antes de empezar</h1>
        <WellnessForm
          clientId={clientId}
          intro="Un check-in rápido antes de entrenar hoy. Tu entrenador lo va a ver."
          submitLabel="Enviar y empezar a entrenar"
          onSubmitted={() => {
            const sId = pendingSessionId;
            setPendingSessionId(null);
            setActiveSessionId(sId);
          }}
        />
      </div>
    );
  }

  if (activeSessionId) {
    return (
      <TrainSession
        sessionId={activeSessionId}
        onExit={async () => {
          setActiveSessionId(null);
          await loadSessions(weekId);
        }}
      />
    );
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Mi rutina</h1>

      {loading ? (
        <p className="note">Cargando…</p>
      ) : !program ? (
        <div className="panel"><div className="bd"><p className="note">Todavía no tienes un programa asignado. Avisa a tu entrenador.</p></div></div>
      ) : (
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
                    <button className="btn" onClick={() => startSession(s.id)} disabled={status === "completed"}>
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

function TrainSession({ sessionId, onExit }: { sessionId: string; onExit: () => void }) {
  const { notify } = useToast();
  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [blocks, setBlocks] = useState<SessionBlockRow[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseRow[]>([]);
  const [setLogs, setSetLogs] = useState<SetLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [restTotal, setRestTotal] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);

  useEffect(() => {
    if (restRemaining <= 0) return;
    const t = window.setInterval(() => setRestRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [restRemaining > 0]);

  const startRest = (seconds: number) => {
    if (!seconds || seconds <= 0) return;
    setRestTotal(seconds);
    setRestRemaining(seconds);
  };

  const load = async () => {
    setLoading(true);
    try {
      const l = await getOrCreateWorkoutLog(sessionId);
      setLog(l);
      const [bl, ex, sl] = await Promise.all([listSessionBlocks(sessionId), listWorkoutExercises(sessionId), listSetLogs(l.id)]);
      setBlocks(bl);
      setExercises(ex);
      setSetLogs(sl);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const blockByKind = useMemo(() => Object.fromEntries(blocks.map((b) => [b.kind, b])), [blocks]);

  const logFor = (exerciseWorkoutId: string, setNumber: number) => setLogs.find((l) => l.workout_exercise_id === exerciseWorkoutId && l.set_number === setNumber);

  const saveSet = async (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean }) => {
    if (!log) return;
    const existing = logFor(ex.id, setNumber);
    const justCompleted = fields.completed && !existing?.completed;
    try {
      const saved = await upsertSetLog({
        existingId: existing?.id,
        workoutLogId: log.id,
        workoutExerciseId: ex.id,
        exerciseId: ex.exercise_id,
        setNumber,
        ...fields,
      });
      setSetLogs((sls) => (existing ? sls.map((s) => (s.id === saved.id ? saved : s)) : [...sls, saved]));
      if (justCompleted && ex.rest_s) startRest(ex.rest_s);
    } catch (e: any) {
      notify(e.message);
    }
  };

  const finish = async () => {
    if (!log) return;
    setSaving(true);
    try {
      await completeWorkout({ workoutLogId: log.id, sessionRpe: rpe ? Number(rpe) : null, comments, startedAt: log.started_at });
      notify("¡Sesión completada! Buen trabajo.");
      onExit();
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="page"><p className="note">Cargando…</p></div>;

  return (
    <div className="page">
      <button onClick={onExit} style={{ border: 0, background: "none", color: "var(--pri)", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <ArrowLeft size={16} /> Volver a mi rutina
      </button>

      {restRemaining > 0 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--nav)",
            color: "#fff",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700 }}>
              Descanso: {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={() => setRestRemaining((s) => s + 15)}>
                +15 s
              </button>
              <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={() => setRestRemaining(0)}>
                Saltar
              </button>
            </div>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,.2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(restRemaining / Math.max(1, restTotal)) * 100}%`, background: "#8FA6F5", transition: "width 1s linear" }} />
          </div>
        </div>
      )}

      {finishing ? (
        <div className="panel" style={{ maxWidth: 420 }}>
          <div className="hd"><h3>¿Cómo sentiste la sesión?</h3></div>
          <div className="bd">
            <label className="field-label">Esfuerzo percibido (0 a 10)</label>
            <select className="input" style={{ marginBottom: 14 }} value={rpe} onChange={(e) => setRpe(e.target.value)}>
              <option value="">Sin indicar</option>
              {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <label className="field-label">Comentarios (opcional)</label>
            <textarea className="input" style={{ minHeight: 70, marginBottom: 16 }} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="¿Cómo te sentiste? ¿Alguna molestia?" />
            <button className="btn" onClick={finish} disabled={saving}>{saving ? "Guardando…" : "Finalizar sesión"}</button>
          </div>
        </div>
      ) : (
        <>
          {BLOCK_ORDER.map((kind) => {
            const block = blockByKind[kind];
            const rows = exercises.filter((e) => block && e.block_id === block.id);
            if (!rows.length) return null;
            const groups = groupBySuperset(rows);
            return (
              <div key={kind} style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 10 }}>{BLOCK_LABEL[kind]}</h3>
                {groups.map((g) =>
                  g.length > 1 && g.every((ex) => !isCardioExercise(ex)) ? (
                    <SupersetTrainer key={g[0].superset_group} exercises={g} logFor={logFor} onSaveSet={saveSet} />
                  ) : (
                    g.map((ex) => <ExerciseTrainer key={ex.id} ex={ex} logFor={logFor} onSaveSet={saveSet} />)
                  )
                )}
              </div>
            );
          })}
          {exercises.length === 0 && <p className="note" style={{ marginBottom: 18 }}>Esta rutina todavía no tiene ejercicios cargados.</p>}
          <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => setFinishing(true)}>
            Terminar entrenamiento
          </button>
        </>
      )}
    </div>
  );
}

function isCardioExercise(ex: WorkoutExerciseRow): boolean {
  return ex.duration_min != null || ex.distance_km != null || ex.steps_target != null;
}

/** Junta los ejercicios de un mismo bloque en grupos: los que comparten superset_group van juntos (biserie/triserie/serie gigante), el resto queda solo en su propio grupo. Conserva el orden original. */
function groupBySuperset(rows: WorkoutExerciseRow[]): WorkoutExerciseRow[][] {
  const groups: WorkoutExerciseRow[][] = [];
  const seen = new Set<number>();
  for (const ex of rows) {
    if (ex.superset_group != null) {
      if (seen.has(ex.superset_group)) continue;
      seen.add(ex.superset_group);
      groups.push(rows.filter((r) => r.superset_group === ex.superset_group));
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}

const SUPERSET_LETTERS = "ABCDEFGH";

function SupersetTrainer({
  exercises,
  logFor,
  onSaveSet,
}: {
  exercises: WorkoutExerciseRow[];
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean }) => void;
}) {
  const label = exercises.length === 2 ? "Biserie" : exercises.length === 3 ? "Triserie" : "Serie gigante";
  const maxSets = Math.max(...exercises.map((ex) => ex.sets ?? 3));
  const rounds = Array.from({ length: maxSets }, (_, i) => i + 1);

  return (
    <div className="panel" style={{ marginBottom: 10, borderLeft: "4px solid var(--pri)" }}>
      <div className="hd">
        <h3 style={{ fontSize: 16 }}>
          {label}: {exercises.map((ex) => ex.exercise_name).join(" + ")}
        </h3>
      </div>
      <div className="bd">
        <p className="note" style={{ marginBottom: 14 }}>
          Hacé una serie de cada ejercicio, en orden, sin descansar entre ellos — el descanso va después de completar la ronda entera.
        </p>
        {rounds.map((roundNumber) => (
          <div key={roundNumber} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: roundNumber < rounds.length ? "1px dashed var(--line)" : "none" }}>
            <div className="note" style={{ marginBottom: 8, fontWeight: 600 }}>Ronda {roundNumber}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {exercises.map((ex, i) => {
                if (roundNumber > (ex.sets ?? 3)) return null;
                const existing = logFor(ex.id, roundNumber);
                const repsTarget = ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max}` : ex.reps_min ?? ex.reps_max ?? "—";
                return (
                  <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: existing?.completed ? "var(--ok-soft)" : "var(--bg)", borderRadius: 8, padding: 8 }}>
                    <span style={{ minWidth: 26, fontWeight: 700, color: "var(--pri)" }}>{SUPERSET_LETTERS[i]}{roundNumber}</span>
                    <span style={{ flex: 1, minWidth: 120 }}>{ex.exercise_name}</span>
                    <span className="note" style={{ fontSize: 12.5 }}>Obj: {repsTarget}{ex.load_value ? ` @ ${ex.load_value}kg` : ""}</span>
                    <MiniSetInputs
                      defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                      defaultLoad={ex.load_value}
                      defaultRir={ex.rir}
                      existing={existing}
                      onSave={(fields) => onSaveSet(ex, roundNumber, fields)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {exercises[0].rest_s ? <p className="note">Descanso entre rondas: {exercises[0].rest_s}s</p> : null}
      </div>
    </div>
  );
}

function MiniSetInputs({
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
}: {
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean }) => void;
}) {
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(existing?.load_kg != null ? String(existing.load_kg) : defaultLoad != null ? String(defaultLoad) : "");
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  const commit = (over?: Partial<{ completed: boolean }>) => {
    onSave({
      reps: Number(reps) || 0,
      loadKg: load === "" ? null : Number(load.replace(",", ".")) || 0,
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input className="input" style={{ width: 50, padding: "5px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => commit()} aria-label="Reps" />
      <input className="input" style={{ width: 55, padding: "5px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => commit()} aria-label="Carga" />
      <input className="input" style={{ width: 45, padding: "5px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={() => commit()} aria-label="RIR" />
      <button
        className="btn ghost"
        style={{ padding: "4px 8px", fontSize: 12.5, background: completed ? "var(--ok-soft)" : undefined }}
        onClick={() => commit({ completed: !completed })}
      >
        <Check size={13} />
      </button>
    </div>
  );
}

function ExerciseTrainer({
  ex,
  logFor,
  onSaveSet,
}: {
  ex: WorkoutExerciseRow;
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean }) => void;
}) {
  const isCardio = ex.duration_min != null || ex.distance_km != null || ex.steps_target != null;

  if (isCardio) {
    const existing = logFor(ex.id, 1);
    return (
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <b>{ex.exercise_name}</b>
            <div className="note">
              {ex.duration_min ? `${ex.duration_min} min` : null}
              {ex.distance_km ? ` · ${ex.distance_km} km` : null}
              {ex.steps_target ? ` · ${ex.steps_target} pasos` : null}
              {ex.hr_zone ? ` · ${ex.hr_zone}` : null}
            </div>
          </div>
          <button
            className="btn ghost"
            style={{ background: existing?.completed ? "var(--ok-soft)" : undefined }}
            onClick={() => onSaveSet(ex, 1, { reps: 0, loadKg: null, rir: null, completed: !existing?.completed })}
          >
            <Check size={14} /> {existing?.completed ? "Hecho" : "Marcar hecho"}
          </button>
        </div>
      </div>
    );
  }

  const sets = ex.sets ?? 3;
  const repsTarget = ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max}` : ex.reps_min ?? ex.reps_max ?? "—";

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div className="hd">
        <h3 style={{ fontSize: 16 }}>{ex.exercise_name}</h3>
        <span className="note">
          Objetivo: {sets}×{repsTarget}{ex.load_value ? ` @ ${ex.load_value} kg` : ""}{ex.rir != null ? ` · RIR ${ex.rir}` : ""}
          {ex.rest_s ? ` · Descanso ${ex.rest_s}s` : ""}{ex.tempo ? ` · Tempo ${ex.tempo}` : ""}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
              <th style={{ padding: "6px 10px" }}>Serie</th>
              <th style={{ padding: "6px 10px" }}>Reps</th>
              <th style={{ padding: "6px 10px" }}>Carga (kg)</th>
              <th style={{ padding: "6px 10px" }}>RIR</th>
              <th style={{ padding: "6px 10px" }} />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sets }, (_, i) => i + 1).map((setNumber) => {
              const existing = logFor(ex.id, setNumber);
              return (
                <SetRow
                  key={setNumber}
                  setNumber={setNumber}
                  defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                  defaultLoad={ex.load_value}
                  defaultRir={ex.rir}
                  existing={existing}
                  onSave={(fields) => onSaveSet(ex, setNumber, fields)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetRow({
  setNumber,
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
}: {
  setNumber: number;
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean }) => void;
}) {
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(existing?.load_kg != null ? String(existing.load_kg) : defaultLoad != null ? String(defaultLoad) : "");
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  const commit = (over?: Partial<{ completed: boolean }>) => {
    onSave({
      reps: Number(reps) || 0,
      loadKg: load === "" ? null : Number(load.replace(",", ".")) || 0,
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
    });
  };

  return (
    <tr style={{ borderTop: "1px solid var(--line)", background: completed ? "var(--ok-soft)" : undefined }}>
      <td style={{ padding: "6px 10px" }}>{setNumber}</td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 60, padding: "6px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 70, padding: "6px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 50, padding: "6px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px 10px" }}>
        <button
          className="btn ghost"
          style={{ padding: "5px 10px", fontSize: 13, background: completed ? "var(--ok-soft)" : undefined }}
          onClick={() => commit({ completed: !completed })}
        >
          <Check size={13} /> {completed ? "Hecha" : "Marcar"}
        </button>
      </td>
    </tr>
  );
}
