import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "../../../contexts/ToastContext";
import { listClients, type ClientRow } from "../../../services/clients";
import { listAssessments, getBodyMeasurement, listStrengthTests, type StrengthTestRow } from "../../../services/assessments";
import { listRecentLogs, wellnessScore } from "../../../services/wellness";
import {
  listWorkoutLogsForClient,
  listSetLogsForClient,
  weeklyCompletedSessions,
  weeklyAvgRPE,
  weeklyVolume,
  type WeeklyPoint,
} from "../../../services/reports";

const COLORS = { pri: "#1E3FA8", ok: "#2E8B6E", warn: "#B77800", bad: "#D6472B" };

interface BodyPoint { date: string; weight: number | null; bodyFat: number | null }
interface StrengthPoint { date: string; value: number }
interface WellnessPoint { date: string; score: number }

const fmtDate = (d: string) => new Date(d).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });

export default function ReportsPage() {
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);

  const [bodyPoints, setBodyPoints] = useState<BodyPoint[]>([]);
  const [allStrengthTests, setAllStrengthTests] = useState<(StrengthTestRow & { date: string })[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [wellnessPoints, setWellnessPoints] = useState<WellnessPoint[]>([]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<WeeklyPoint[]>([]);
  const [rpePerWeek, setRpePerWeek] = useState<WeeklyPoint[]>([]);
  const [volumePerWeek, setVolumePerWeek] = useState<WeeklyPoint[]>([]);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    (async () => {
      try {
        const assessments = await listAssessments(clientId);
        const bodyRows: BodyPoint[] = [];
        const strengthRows: (StrengthTestRow & { date: string })[] = [];
        for (const a of assessments) {
          const [b, s] = await Promise.all([getBodyMeasurement(a.id), listStrengthTests(a.id)]);
          if (b) bodyRows.push({ date: a.assessed_at, weight: b.weight_kg, bodyFat: b.body_fat_pct });
          for (const row of s) strengthRows.push({ ...row, date: a.assessed_at });
        }
        bodyRows.sort((x, y) => x.date.localeCompare(y.date));
        strengthRows.sort((x, y) => x.date.localeCompare(y.date));
        setBodyPoints(bodyRows);
        setAllStrengthTests(strengthRows);
        setExerciseId((prev) => prev || strengthRows[0]?.exercise_id || "");

        const wlogs = await listRecentLogs(clientId, 90);
        setWellnessPoints(wlogs.map((l) => ({ date: l.log_date, score: wellnessScore(l) })).sort((x, y) => x.date.localeCompare(y.date)));

        const [workoutLogs, setLogs] = await Promise.all([listWorkoutLogsForClient(clientId, 90), listSetLogsForClient(clientId, 90)]);
        setSessionsPerWeek(weeklyCompletedSessions(workoutLogs));
        setRpePerWeek(weeklyAvgRPE(workoutLogs));
        setVolumePerWeek(weeklyVolume(setLogs));
      } catch (e: any) {
        notify(e.message);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const exerciseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of allStrengthTests) seen.set(t.exercise_id, t.exercise_name ?? "");
    return [...seen.entries()];
  }, [allStrengthTests]);

  const strengthSeries: StrengthPoint[] = useMemo(
    () => allStrengthTests.filter((t) => t.exercise_id === exerciseId).map((t) => ({ date: t.date, value: t.estimated_1rm })),
    [allStrengthTests, exerciseId]
  );

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Reportes</h1>
      <p className="note" style={{ marginBottom: 20 }}>Evolución real de cada cliente, armada a partir de sus evaluaciones, su bienestar diario y los entrenamientos que ya completó.</p>

      <div style={{ marginBottom: 24, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {!clientId && <p className="note">Elige un cliente para ver sus reportes.</p>}
      {clientId && loading && <p className="note">Cargando…</p>}

      {clientId && !loading && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <div className="hd"><h3>Peso y % de grasa corporal</h3></div>
            <div className="bd">
              {bodyPoints.length < 2 ? (
                <p className="note">Hacen falta al menos 2 evaluaciones con datos corporales para ver una tendencia.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={bodyPoints.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="dateLabel" fontSize={12} />
                    <YAxis yAxisId="weight" fontSize={12} />
                    <YAxis yAxisId="fat" orientation="right" fontSize={12} />
                    <Tooltip />
                    <Line yAxisId="weight" type="monotone" dataKey="weight" name="Peso (kg)" stroke={COLORS.pri} strokeWidth={2} dot connectNulls />
                    <Line yAxisId="fat" type="monotone" dataKey="bodyFat" name="% grasa" stroke={COLORS.warn} strokeWidth={2} dot connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Fuerza (1RM estimado)</h3></div>
            <div className="bd">
              {exerciseOptions.length === 0 ? (
                <p className="note">Este cliente todavía no tiene pruebas de fuerza registradas en Evaluaciones.</p>
              ) : (
                <>
                  <select className="input" style={{ maxWidth: 260, marginBottom: 14 }} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                    {exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                  {strengthSeries.length < 2 ? (
                    <p className="note">Hace falta al menos 2 pruebas de este ejercicio para ver una tendencia.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={strengthSeries.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="dateLabel" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" name="1RM estimado (kg)" stroke={COLORS.pri} strokeWidth={2} dot />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Bienestar (Wellness Score)</h3></div>
            <div className="bd">
              {wellnessPoints.length < 2 ? (
                <p className="note">Todavía no hay suficientes registros de bienestar para ver una tendencia.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={wellnessPoints.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="dateLabel" fontSize={12} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" name="Wellness Score" stroke={COLORS.ok} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Entrenamiento por semana</h3></div>
            <div className="bd">
              {sessionsPerWeek.length === 0 ? (
                <p className="note">Este cliente todavía no completó ninguna sesión en los últimos 90 días.</p>
              ) : (
                <>
                  <p className="note" style={{ marginBottom: 10 }}>Sesiones completadas</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={sessionsPerWeek.map((p) => ({ ...p, weekLabel: fmtDate(p.week) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="weekLabel" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" name="Sesiones" fill={COLORS.pri} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {volumePerWeek.length > 0 && (
                    <>
                      <p className="note" style={{ margin: "18px 0 10px" }}>Volumen total (reps × carga)</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={volumePerWeek.map((p) => ({ ...p, weekLabel: fmtDate(p.week) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="weekLabel" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" name="Volumen (kg)" stroke={COLORS.pri} strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {rpePerWeek.length > 0 && (
                    <>
                      <p className="note" style={{ margin: "18px 0 10px" }}>Esfuerzo percibido promedio por sesión (RPE)</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={rpePerWeek.map((p) => ({ ...p, weekLabel: fmtDate(p.week) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="weekLabel" fontSize={12} />
                          <YAxis domain={[0, 10]} fontSize={12} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" name="RPE" stroke={COLORS.bad} strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
