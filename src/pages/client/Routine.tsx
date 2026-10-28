import { useEffect, useMemo, useState } from "react";
import { Check, ArrowLeft, Flame } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import Chip from "../../components/ui/Chip";
import { getMyClientId } from "../../services/clients";
import { listWeeks, type ProgramRow, type WeekRow } from "../../services/programs";
import {
  listSessions,
  listSessionBlocks,
  listWorkoutExercises,
  BLOCK_LABEL,
  BLOCK_ORDER,
  DAY_OF_WEEK_LABEL,
  todayDayOfWeek,
  computeWeekStatuses,
  WEEK_STATUS_COLOR,
  WEEK_STATUS_LABEL,
  listSetNotesForExercises,
  type SessionRow,
  type SessionBlockRow,
  type WorkoutExerciseRow,
  type WeekStatus,
} from "../../services/sessions";
import {
  getActiveProgramForClient,
  getOrCreateWorkoutLog,
  listSetLogs,
  upsertSetLog,
  completeWorkout,
  getSessionStatuses,
  getTodayCompletedSessionName,
  getLastPerformance,
  type WorkoutLogRow,
  type SetLogRow,
  type LastPerformance,
} from "../../services/training";
import WellnessForm from "../../components/WellnessForm";
import { getExerciseMediaUrl, listVariationsFor, RELATION_LABEL, type ExerciseVariationRow } from "../../services/exercises";
import Loading from "../../components/ui/Loading";
import { listRecordsForWorkout, describeRecord, type MyRecord } from "../../services/clientHome";
import { formatLoad, loadInputValue, parseLoadToKg, type LoadUnit } from "../../lib/units";
import { getEffectiveGymUnits, getEquipmentNames, makeUnitResolver } from "../../services/units";

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
  const [weekStatus, setWeekStatus] = useState<Record<string, WeekStatus>>({});
  const [weekId, setWeekId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkoutLogRow["status"]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedByDailyLimit, setBlockedByDailyLimit] = useState<string | null>(null);
  const [pendingWarning, setPendingWarning] = useState<{ sessionId: string; weekLabel: string } | null>(null);

  /**
   * No bloquea nada — solo avisa si la semana anterior quedó con rutinas sin
   * terminar, y deja que el cliente decida igual. Un aviso, no un candado:
   * la vida real (viajes, una semana saltada a propósito) no siempre sigue
   * el orden prolijo del plan.
   */
  const previousWeekIncompleteLabel = async (currentWeekId: string): Promise<string | null> => {
    const current = weeks.find((w) => w.id === currentWeekId);
    if (!current) return null;
    const prevWeek = weeks.find((w) => w.week_number === current.week_number - 1);
    if (!prevWeek) return null;
    try {
      const prevSessions = await listSessions(prevWeek.id);
      if (prevSessions.length === 0) return null;
      const prevStatuses = await getSessionStatuses(prevSessions.map((s) => s.id));
      const allDone = prevSessions.every((s) => {
        const st = prevStatuses[s.id] ?? "pending";
        return st === "completed" || st === "skipped";
      });
      return allDone ? null : `Semana ${prevWeek.week_number}`;
    } catch {
      return null;
    }
  };

  const startSession = async (sessionId: string) => {
    if (!clientId) return;
    if (!program?.allow_multiple_sessions_per_day) {
      try {
        const doneToday = await getTodayCompletedSessionName(clientId);
        if (doneToday) {
          setBlockedByDailyLimit(doneToday);
          return;
        }
      } catch (e: any) {
        notify(e.message);
        return;
      }
    }
    const incompleteWeek = await previousWeekIncompleteLabel(weekId);
    if (incompleteWeek) {
      setPendingWarning({ sessionId, weekLabel: incompleteWeek });
      return;
    }
    setPendingSessionId(sessionId);
  };

  const loadSessions = async (wId: string) => {
    const ss = await listSessions(wId);
    setSessions(ss);
    const st = await getSessionStatuses(ss.map((s) => s.id));
    setStatuses(st);
    const status: WeekStatus = ss.length === 0 ? "empty" : ss.some((s) => (st[s.id] ?? "pending") !== "pending") ? "started" : "planned";
    setWeekStatus((prev) => ({ ...prev, [wId]: status }));
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
        computeWeekStatuses(ws.map((w) => w.id)).then(setWeekStatus).catch(() => {});
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
        <Loading />
      ) : !program ? (
        <div className="panel"><div className="bd"><p className="note">Todavía no tienes un programa asignado. Avisa a tu entrenador.</p></div></div>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 14 }}>{program.name}</p>
          {weeks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {weeks.map((w) => {
                const status = weekStatus[w.id] ?? "empty";
                return (
                  <button
                    key={w.id}
                    onClick={() => setWeekId(w.id)}
                    className="btn ghost"
                    title={WEEK_STATUS_LABEL[status]}
                    style={{ padding: "6px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7, background: w.id === weekId ? "var(--pri)" : "transparent", color: w.id === weekId ? "#fff" : "var(--pri)" }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: WEEK_STATUS_COLOR[status], flex: "none", border: w.id === weekId ? "1px solid rgba(255,255,255,.6)" : "none" }} />
                    Semana {w.week_number}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((s) => {
              const status = statuses[s.id] ?? "pending";
              const isToday = s.day_of_week === todayDayOfWeek();
              return (
                <div key={s.id} className="panel" style={isToday ? { borderLeft: "4px solid var(--pri)" } : undefined}>
                  <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b>{s.name}</b>
                        {isToday && <Chip tone="pri">Hoy</Chip>}
                      </div>
                      <div className="note">
                        {STATUS_LABEL[status]}
                        {s.day_of_week ? ` · ${DAY_OF_WEEK_LABEL[s.day_of_week]}` : ""}
                      </div>
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

      {blockedByDailyLimit && (
        <Modal title="Ya entrenaste hoy" onClose={() => setBlockedByDailyLimit(null)}>
          <p>
            Ya completaste "{blockedByDailyLimit}" hoy. Tu entrenador no habilitó más de una rutina por día en este programa — si hoy te toca otra, avísale.
          </p>
        </Modal>
      )}

      {pendingWarning && (
        <Modal title="Tienes una semana sin terminar" onClose={() => setPendingWarning(null)}>
          <p style={{ marginBottom: 18 }}>
            Todavía te falta completar rutinas de la {pendingWarning.weekLabel}. ¿Igual quieres entrenar esta ahora?
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setPendingWarning(null)}>Volver</button>
            <button
              className="btn"
              onClick={() => {
                setPendingSessionId(pendingWarning.sessionId);
                setPendingWarning(null);
              }}
            >
              Entrenar igual
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function TrainSession({ sessionId, onExit, backLabel = "Volver a mi rutina" }: { sessionId: string; onExit: () => void; backLabel?: string }) {
  const { notify } = useToast();
  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [blocks, setBlocks] = useState<SessionBlockRow[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseRow[]>([]);
  const [setLogs, setSetLogs] = useState<SetLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState("");
  const [comments, setComments] = useState("");
  const [celebration, setCelebration] = useState<MyRecord[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [restTotal, setRestTotal] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  // Guarda el momento real en que termina el descanso, en vez de solo restar de a uno
  // cada segundo — así, si el celular se bloquea o cambias de app durante el descanso
  // (el navegador pausa los conteos en ese caso para ahorrar batería), al volver el
  // cronómetro muestra el tiempo real que pasó, no el tiempo que alcanzó a contar.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restAnchor, setRestAnchor] = useState<string | null>(null);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance | null>>({});
  const [variations, setVariations] = useState<Record<string, ExerciseVariationRow[]>>({});
  const [setNotesByExercise, setSetNotesByExercise] = useState<Record<string, Record<number, string>>>({});
  // kg o lb para cada ejercicio, según el gimnasio del alumno (ver lib/units.ts).
  const [unitResolver, setUnitResolver] = useState<{ fn: (ex: WorkoutExerciseRow) => LoadUnit }>({ fn: () => "kg" });
  const { profile: authProfile } = useAuth();

  useEffect(() => {
    if (!restEndsAt) {
      setRestRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestRemaining(remaining);
      if (remaining <= 0) setRestEndsAt(null);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restEndsAt]);

  const startRest = (seconds: number, anchor: string) => {
    if (!seconds || seconds <= 0) return;
    setRestTotal(seconds);
    setRestEndsAt(Date.now() + seconds * 1000);
    setRestAnchor(anchor);
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

      // Unidad de cada ejercicio (kg / lb), según dónde entrena el alumno.
      Promise.all([getEffectiveGymUnits(l.client_id, authProfile?.organization_id ?? null), getEquipmentNames()])
        .then(([gym, eq]) => setUnitResolver({ fn: makeUnitResolver(gym, eq) }))
        .catch(() => {});

      const uniqueExerciseIds = [...new Set(ex.map((e) => e.exercise_id))];
      const perfEntries = await Promise.all(
        uniqueExerciseIds.map(async (exId) => [exId, await getLastPerformance(l.client_id, exId, l.id).catch(() => null)] as const)
      );
      setLastPerf(Object.fromEntries(perfEntries));

      const variationEntries = await Promise.all(
        uniqueExerciseIds.map(async (exId) => [exId, await listVariationsFor(exId).catch((e: any) => { notify(`No pudimos cargar las alternativas: ${e.message}`); return []; })] as const)
      );
      setVariations(Object.fromEntries(variationEntries));

      setSetNotesByExercise(await listSetNotesForExercises(ex.map((e) => e.id)).catch(() => ({})));
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

  const saveSet = async (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => {
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
      if (justCompleted && ex.rest_s) startRest(ex.rest_s, `${ex.id}:${setNumber}`);
    } catch (e: any) {
      notify(e.message);
    }
  };

  const finish = async () => {
    if (!log) return;
    setSaving(true);
    try {
      await completeWorkout({ workoutLogId: log.id, sessionRpe: rpe ? Number(rpe) : null, comments, startedAt: log.started_at });
      // ¿Batió algún récord en esta sesión? Si sí, se celebra antes de salir.
      const recs = await listRecordsForWorkout(log.id).catch((): MyRecord[] => []);
      if (recs.length > 0) {
        setCelebration(recs);
      } else {
        notify("¡Sesión completada! Buen trabajo.");
        onExit();
      }
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  if (celebration) {
    return (
      <div className="page">
        <div className="panel celebrate">
          <div className="bd" style={{ padding: "28px 22px" }}>
            <div className="burst">🏆</div>
            <h2 style={{ margin: "10px 0 4px" }}>
              {celebration.length === 1 ? "¡Nuevo récord!" : `¡${celebration.length} récords nuevos!`}
            </h2>
            <p className="note" style={{ marginTop: 0 }}>Sesión completada. Hoy superaste tu mejor marca en:</p>
            <div style={{ display: "grid", gap: 10, textAlign: "left", margin: "16px 0 20px" }}>
              {celebration.map((r) => (
                <div key={r.id} style={{ background: "var(--ok-soft)", borderRadius: 9, padding: "10px 12px" }}>
                  <b>{r.exercise_name}</b>
                  <div className="note" style={{ fontSize: 13 }}>{describeRecord(r)}</div>
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={onExit}>¡Genial!</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <button onClick={onExit} style={{ border: 0, background: "none", color: "var(--pri)", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <ArrowLeft size={16} /> {backLabel}
      </button>

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
                    <SupersetTrainer
                      key={g[0].superset_group}
                      exercises={g}
                      logFor={logFor}
                      onSaveSet={saveSet}
                      restAnchor={restAnchor}
                      restRemaining={restRemaining}
                      restTotal={restTotal}
                      onAddRestTime={() => setRestEndsAt((e) => (e ? e + 15000 : e))}
                      onSkipRest={() => setRestEndsAt(null)}
                      lastPerf={lastPerf}
                      variations={variations}
                      setNotesByExercise={setNotesByExercise}
                      unitFor={unitResolver.fn}
                    />
                  ) : (
                    g.map((ex) => (
                      <ExerciseTrainer
                        key={ex.id}
                        ex={ex}
                        logFor={logFor}
                        onSaveSet={saveSet}
                        restAnchor={restAnchor}
                        restRemaining={restRemaining}
                        restTotal={restTotal}
                        onAddRestTime={() => setRestEndsAt((e) => (e ? e + 15000 : e))}
                        onSkipRest={() => setRestEndsAt(null)}
                        lastPerf={lastPerf[ex.exercise_id] ?? null}
                        variations={variations[ex.exercise_id] ?? []}
                        setNotes={setNotesByExercise[ex.id] ?? {}}
                        unit={unitResolver.fn(ex)}
                      />
                    ))
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

function RestTimer({ remaining, total, onAddTime, onSkip }: { remaining: number; total: number; onAddTime: () => void; onSkip: () => void }) {
  return (
    <div style={{ background: "var(--nav)", color: "#fff", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 700 }}>
          Descanso: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={onAddTime}>
            +15 s
          </button>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={onSkip}>
            Saltar
          </button>
        </div>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,.2)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(remaining / Math.max(1, total)) * 100}%`, background: "#8FA6F5", transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

function ExerciseMedia({ mediaPath, mediaType, label }: { mediaPath: string | null; mediaType: "image" | "video" | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  if (!mediaPath) return null;

  const toggle = async () => {
    if (!open && !url) {
      try {
        setUrl(await getExerciseMediaUrl(mediaPath));
      } catch {
        return;
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button" className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={toggle}>
        {open ? `Ocultar${label ? ` — ${label}` : ""}` : `Ver demostración${label ? ` — ${label}` : ""}`}
      </button>
      {open && url && (
        mediaType === "video" ? (
          <video src={url} controls style={{ width: "100%", maxHeight: 220, borderRadius: 8, background: "#000", marginTop: 8 }} />
        ) : (
          <img src={url} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, marginTop: 8 }} />
        )
      )}
    </div>
  );
}

function VariationsNote({ items }: { items: ExerciseVariationRow[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button" className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setOpen((o) => !o)}>
        {open ? "Ocultar alternativas" : "Ver alternativas"}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {items.map((v) => (
            <p key={v.id} className="note" style={{ margin: 0 }}>
              <b style={{ color: "var(--text)" }}>{RELATION_LABEL[v.relation]}:</b> {v.related_exercise_name}
              {v.notes ? ` — ${v.notes}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function LastPerformanceNote({ perf }: { perf: LastPerformance | null }) {
  if (!perf) return null;
  const sets = Object.entries(perf.bySet).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <p className="note" style={{ marginBottom: 8 }}>
      Última vez ({new Date(perf.date).toLocaleDateString("es")}): {sets.map(([n, s]) => `S${n}: ${s.loadKg != null ? formatLoad(s.loadKg, s.unit) : "—"} × ${s.reps}`).join(" · ")}
    </p>
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
  restAnchor,
  restRemaining,
  restTotal,
  onAddRestTime,
  onSkipRest,
  lastPerf,
  variations,
  setNotesByExercise,
  unitFor,
}: {
  exercises: WorkoutExerciseRow[];
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  restAnchor: string | null;
  restRemaining: number;
  restTotal: number;
  onAddRestTime: () => void;
  onSkipRest: () => void;
  lastPerf: Record<string, LastPerformance | null>;
  variations: Record<string, ExerciseVariationRow[]>;
  setNotesByExercise: Record<string, Record<number, string>>;
  unitFor: (ex: WorkoutExerciseRow) => LoadUnit;
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
        {exercises.some((ex) => ex.media_path) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {exercises.map((ex, i) => (
              <ExerciseMedia key={ex.id} mediaPath={ex.media_path} mediaType={ex.media_type} label={`${SUPERSET_LETTERS[i]} — ${ex.exercise_name}`} />
            ))}
          </div>
        )}
        {exercises.map((ex) => (
          <div key={ex.id}>
            <LastPerformanceNote perf={lastPerf[ex.exercise_id] ?? null} />
            <VariationsNote items={variations[ex.exercise_id] ?? []} />
          </div>
        ))}
        <p className="note" style={{ marginBottom: 14 }}>
          Haz una serie de cada ejercicio, en orden, sin descansar entre ellos — el descanso va después de completar la ronda entera.
        </p>
        {rounds.map((roundNumber) => {
          const showRestHere = restRemaining > 0 && exercises.some((ex) => restAnchor === `${ex.id}:${roundNumber}`);
          return (
            <div key={roundNumber} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: roundNumber < rounds.length ? "1px dashed var(--line)" : "none" }}>
              <div className="note" style={{ marginBottom: 8, fontWeight: 600 }}>Ronda {roundNumber}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {exercises.map((ex, i) => {
                  if (roundNumber > (ex.sets ?? 3)) return null;
                  const existing = logFor(ex.id, roundNumber);
                  const repsTarget = ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max}` : ex.reps_min ?? ex.reps_max ?? "—";
                  const note = setNotesByExercise[ex.id]?.[roundNumber];
                  return (
                    <div key={ex.id} style={{ display: "grid", gap: 6 }}>
                      {note && <SetNoteBanner note={note} />}
                      <div className="complete-transition" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: existing?.completed ? "var(--ok-soft)" : "var(--bg)", borderRadius: 8, padding: 8 }}>
                        <span style={{ minWidth: 26, fontWeight: 700, color: "var(--pri)" }}>{SUPERSET_LETTERS[i]}{roundNumber}</span>
                        <span style={{ flex: 1, minWidth: 120 }}>{ex.exercise_name}</span>
                        <span className="note" style={{ fontSize: 12.5 }}>Obj: {repsTarget}{ex.load_value ? ` @ ${formatLoad(ex.load_value, unitFor(ex))}` : ""}</span>
                        <MiniSetInputs
                          key={`${ex.id}-${roundNumber}-${unitFor(ex)}`}
                          exUnit={unitFor(ex)}
                          defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                          defaultLoad={ex.load_value}
                          defaultRir={ex.rir}
                          existing={existing}
                          onSave={(fields) => onSaveSet(ex, roundNumber, fields)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniSetInputs({
  exUnit,
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
}: {
  exUnit: LoadUnit;
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
}) {
  const [unit, setUnit] = useState<LoadUnit>(existing?.load_unit ?? exUnit);
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(loadInputValue(existing?.load_kg ?? defaultLoad, existing?.load_unit ?? exUnit));
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  const commit = (over?: Partial<{ completed: boolean; unit: LoadUnit; load: string }>) => {
    const u = over?.unit ?? unit;
    const l = over?.load ?? load;
    onSave({
      reps: Number(reps) || 0,
      loadKg: parseLoadToKg(l, u), // siempre se guarda en kg
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
      loadUnit: u,
    });
  };

  // Cambiar kg ↔ lb convierte lo que está escrito (mismo peso, otra unidad).
  const toggleUnit = () => {
    const next: LoadUnit = unit === "kg" ? "lb" : "kg";
    const kg = parseLoadToKg(load, unit);
    const nextLoad = kg == null ? "" : loadInputValue(kg, next);
    setUnit(next);
    setLoad(nextLoad);
    if (existing) commit({ unit: next, load: nextLoad });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input className="input" style={{ width: 50, padding: "5px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => commit()} aria-label="Reps" />
      <input className="input" inputMode="decimal" style={{ width: 55, padding: "5px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => commit()} aria-label={`Carga en ${unit}`} />
      <button type="button" className="unit-toggle" onClick={toggleUnit} title="Cambiar entre kg y libras">{unit}</button>
      <input className="input" style={{ width: 45, padding: "5px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={() => commit()} aria-label="RIR" />
      <button
        className="btn ghost complete-transition"
        style={{ padding: "4px 8px", fontSize: 12.5, background: completed ? "var(--ok-soft)" : undefined }}
        onClick={() => commit({ completed: !completed })}
      >
        <Check size={13} className={completed ? "check-pop" : undefined} />
      </button>
    </div>
  );
}

function ExerciseTrainer({
  ex,
  logFor,
  onSaveSet,
  restAnchor,
  restRemaining,
  restTotal,
  onAddRestTime,
  onSkipRest,
  lastPerf,
  variations,
  setNotes,
  unit,
}: {
  ex: WorkoutExerciseRow;
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  restAnchor: string | null;
  restRemaining: number;
  restTotal: number;
  onAddRestTime: () => void;
  onSkipRest: () => void;
  lastPerf: LastPerformance | null;
  variations: ExerciseVariationRow[];
  setNotes: Record<number, string>;
  unit: LoadUnit;
}) {
  const showRestHere = restRemaining > 0 && restAnchor != null && restAnchor.startsWith(`${ex.id}:`);
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
            className="btn ghost complete-transition"
            style={{ background: existing?.completed ? "var(--ok-soft)" : undefined }}
            onClick={() => onSaveSet(ex, 1, { reps: 0, loadKg: null, rir: null, completed: !existing?.completed })}
          >
            <Check size={14} className={existing?.completed ? "check-pop" : undefined} /> {existing?.completed ? "Hecho" : "Marcar hecho"}
          </button>
        </div>
        <div className="bd" style={{ paddingTop: 0 }}>
          <ExerciseMedia mediaPath={ex.media_path} mediaType={ex.media_type} />
          <LastPerformanceNote perf={lastPerf} />
          <VariationsNote items={variations} />
        </div>
        {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
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
          Objetivo: {sets}×{repsTarget}{ex.load_value ? ` @ ${formatLoad(ex.load_value, unit)}` : ""}{ex.rir != null ? ` · RIR ${ex.rir}` : ""}
          {ex.rest_s ? ` · Descanso ${ex.rest_s}s` : ""}{ex.tempo ? ` · Tempo ${ex.tempo}` : ""}
        </span>
      </div>
      <div className="bd" style={{ paddingBottom: 0 }}>
        <ExerciseMedia mediaPath={ex.media_path} mediaType={ex.media_type} />
        <LastPerformanceNote perf={lastPerf} />
        <VariationsNote items={variations} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
              <th style={{ padding: "6px 10px" }}>Serie</th>
              <th style={{ padding: "6px 10px" }}>Reps</th>
              <th style={{ padding: "6px 10px" }}>Carga</th>
              <th style={{ padding: "6px 10px" }}>RIR</th>
              <th style={{ padding: "6px 10px" }} />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sets }, (_, i) => i + 1).map((setNumber) => {
              const existing = logFor(ex.id, setNumber);
              return (
                <SetRow
                  key={`${setNumber}-${unit}`}
                  exUnit={unit}
                  setNumber={setNumber}
                  defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                  defaultLoad={ex.load_value}
                  defaultRir={ex.rir}
                  existing={existing}
                  onSave={(fields) => onSaveSet(ex, setNumber, fields)}
                  note={setNotes?.[setNumber]}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
    </div>
  );
}

function SetNoteBanner({ note }: { note: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "var(--warn-soft)",
        color: "var(--warn)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Flame size={15} style={{ flex: "none", marginTop: 1 }} />
      <span>{note}</span>
    </div>
  );
}

function SetRow({
  exUnit,
  setNumber,
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
  note,
}: {
  exUnit: LoadUnit;
  setNumber: number;
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  note?: string;
}) {
  const [unit, setUnit] = useState<LoadUnit>(existing?.load_unit ?? exUnit);
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(loadInputValue(existing?.load_kg ?? defaultLoad, existing?.load_unit ?? exUnit));
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  const commit = (over?: Partial<{ completed: boolean; unit: LoadUnit; load: string }>) => {
    const u = over?.unit ?? unit;
    const l = over?.load ?? load;
    onSave({
      reps: Number(reps) || 0,
      loadKg: parseLoadToKg(l, u), // siempre se guarda en kg
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
      loadUnit: u,
    });
  };

  // Cambiar kg ↔ lb convierte lo que está escrito (mismo peso, otra unidad).
  const toggleUnit = () => {
    const next: LoadUnit = unit === "kg" ? "lb" : "kg";
    const kg = parseLoadToKg(load, unit);
    const nextLoad = kg == null ? "" : loadInputValue(kg, next);
    setUnit(next);
    setLoad(nextLoad);
    if (existing) commit({ unit: next, load: nextLoad });
  };

  return (
    <>
      {note && (
        <tr>
          <td colSpan={5} style={{ padding: "4px 10px" }}>
            <SetNoteBanner note={note} />
          </td>
        </tr>
      )}
      <tr className="complete-transition" style={{ borderTop: "1px solid var(--line)", background: completed ? "var(--ok-soft)" : undefined }}>
      <td style={{ padding: "6px 10px" }}>{setNumber}</td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 60, padding: "6px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input className="input" inputMode="decimal" style={{ width: 70, padding: "6px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => commit()} aria-label={`Carga en ${unit}`} />
          <button type="button" className="unit-toggle" onClick={toggleUnit} title="Cambiar entre kg y libras">{unit}</button>
        </div>
      </td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 50, padding: "6px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px 10px" }}>
        <button
          className="btn ghost complete-transition"
          style={{ padding: "5px 10px", fontSize: 13, background: completed ? "var(--ok-soft)" : undefined }}
          onClick={() => commit({ completed: !completed })}
        >
          <Check size={13} className={completed ? "check-pop" : undefined} /> {completed ? "Hecha" : "Marcar"}
        </button>
      </td>
      </tr>
    </>
  );
}
