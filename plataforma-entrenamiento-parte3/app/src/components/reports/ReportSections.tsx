import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SITE_LABEL, type CircumferenceSite } from "../../services/assessments";
import { WELLNESS_FIELDS, WELLNESS_FIELD_LABEL, type WellnessField } from "../../services/wellness";
import type { WeeklyPoint } from "../../services/reports";
import {
  listProgressPhotos,
  groupPhotosBySession,
  getPhotoUrl,
  ANGLE_LABEL,
  type ProgressPhotoRow,
} from "../../services/progressPhotos";
import Loading from "../ui/Loading";

export const COLORS = { pri: "#1E3FA8", ok: "#2E8B6E", warn: "#B77800", bad: "#D6472B", muted: "#8A93A6", purple: "#7B4FE0" };
const LINE_PALETTE = [COLORS.pri, COLORS.bad, COLORS.ok, COLORS.warn, COLORS.purple];

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });

const fmtFullDate = (d: string) => new Date(d).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * A diferencia de las demás secciones de este archivo, esta busca sus propios
 * datos (fotos y sus URLs firmadas) en vez de recibirlos ya armados — tiene
 * sentido porque las URLs firmadas vencen y conviene resolverlas justo antes
 * de mostrarlas, no en el momento en que se cargó el resto del reporte.
 *
 * Solo muestra la primera sesión de fotos y la más reciente (no la galería
 * completa) para que el reporte quede como una comparación de antes/ahora,
 * no como un álbum — para eso ya está la pantalla de Fotos.
 */
export function PhotoBeforeAfter({ clientId, restrictToShared }: { clientId: string; restrictToShared: boolean }) {
  const [sessions, setSessions] = useState<{ key: string; date: string | null; photos: ProgressPhotoRow[] }[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setSessions(null);
    listProgressPhotos(clientId)
      .then(async (photos) => {
        const visible = restrictToShared ? photos.filter((p) => p.visibility === "client_and_trainer") : photos;
        const grouped = groupPhotosBySession(visible);
        if (cancelled) return;
        setSessions(grouped);
        const first = grouped[grouped.length - 1];
        const last = grouped[0];
        const toResolve = [...(first?.photos ?? []), ...(last && last !== first ? last.photos : [])];
        const entries = await Promise.all(toResolve.map(async (p) => [p.id, await getPhotoUrl(p.storage_path).catch(() => "")] as const));
        if (!cancelled) setUrls(Object.fromEntries(entries));
      })
      .catch(() => setSessions([]));
    return () => {
      cancelled = true;
    };
  }, [clientId, restrictToShared]);

  if (sessions === null) return <Loading text="Cargando fotos…" />;
  if (sessions.length === 0) return <p className="note">Todavía no hay fotos de progreso cargadas.</p>;

  const first = sessions[sessions.length - 1];
  const last = sessions[0];
  const sameSession = first.key === last.key;

  const renderSession = (session: { date: string | null; photos: ProgressPhotoRow[] }, label: string) => (
    <div>
      <div className="note" style={{ marginBottom: 8, fontWeight: 600 }}>
        {label} {session.date ? `— ${fmtFullDate(session.date)}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
        {session.photos.map((p) => (
          <div key={p.id}>
            {urls[p.id] ? (
              <img src={urls[p.id]} alt={p.angle ?? ""} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 8, background: "var(--bg)" }} />
            )}
            <div className="note" style={{ fontSize: 11.5, textAlign: "center", marginTop: 4 }}>{ANGLE_LABEL[p.angle ?? "front"]}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (sameSession) return renderSession(first, "Única sesión registrada hasta ahora");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      {renderSession(first, "Primera sesión")}
      {renderSession(last, "Última sesión")}
    </div>
  );
}

export interface BodyPoint { date: string; weight: number | null; bodyFat: number | null }

export function BodyCompositionChart({ points }: { points: BodyPoint[] }) {
  if (points.length < 2) return <p className="note">Hacen falta al menos 2 evaluaciones con datos corporales para ver una tendencia.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="dateLabel" fontSize={12} />
        <YAxis yAxisId="weight" fontSize={12} />
        <YAxis yAxisId="fat" orientation="right" fontSize={12} />
        <Tooltip />
        <Legend />
        <Line yAxisId="weight" type="monotone" dataKey="weight" name="Peso (kg)" stroke={COLORS.pri} strokeWidth={2} dot connectNulls />
        <Line yAxisId="fat" type="monotone" dataKey="bodyFat" name="% grasa" stroke={COLORS.warn} strokeWidth={2} dot connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface CircSeriesPoint { date: string; value: number }

export function CircumferenceChart({
  siteOptions,
  site,
  onSiteChange,
  series,
}: {
  siteOptions: CircumferenceSite[];
  site: CircumferenceSite | "";
  onSiteChange: (s: CircumferenceSite) => void;
  series: CircSeriesPoint[];
}) {
  if (siteOptions.length === 0) return <p className="note">Este cliente todavía no tiene circunferencias registradas en Evaluaciones.</p>;
  return (
    <>
      <select className="input" style={{ maxWidth: 220, marginBottom: 14 }} value={site} onChange={(e) => onSiteChange(e.target.value as CircumferenceSite)}>
        {siteOptions.map((s) => <option key={s} value={s}>{SITE_LABEL[s]}</option>)}
      </select>
      {series.length < 2 ? (
        <p className="note">Hacen falta al menos 2 mediciones de esta zona para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="cm" stroke={COLORS.pri} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

export function SkinfoldSumChart({ points }: { points: { date: string; sum: number }[] }) {
  if (points.length < 2) return <p className="note">Hacen falta al menos 2 evaluaciones con los 8 pliegues completos para ver una tendencia.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="dateLabel" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="sum" name="Σ8 (mm)" stroke={COLORS.purple} strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StrengthChart({
  exerciseOptions,
  exerciseId,
  onExerciseChange,
  series,
}: {
  exerciseOptions: [string, string][];
  exerciseId: string;
  onExerciseChange: (id: string) => void;
  series: { date: string; value: number }[];
}) {
  if (exerciseOptions.length === 0) return <p className="note">Este cliente todavía no tiene pruebas de fuerza registradas en Evaluaciones.</p>;
  return (
    <>
      <select className="input" style={{ maxWidth: 260, marginBottom: 14 }} value={exerciseId} onChange={(e) => onExerciseChange(e.target.value)}>
        {exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      {series.length < 2 ? (
        <p className="note">Hace falta al menos 2 pruebas de este ejercicio para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="1RM estimado (kg)" stroke={COLORS.pri} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

export interface PersonalRecord { exerciseId: string; exerciseName: string; best1RM: number; date: string }

export function PersonalRecordsList({ records }: { records: PersonalRecord[] }) {
  if (records.length === 0) return <p className="note">Todavía no hay pruebas de fuerza para calcular récords.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
      {records.map((r) => (
        <div key={r.exerciseId} className="panel" style={{ margin: 0 }}>
          <div className="bd">
            <div className="note">{r.exerciseName}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{r.best1RM} kg</div>
            <div className="note" style={{ fontSize: 12 }}>{fmtDate(r.date)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WellnessBreakdownChart({ points }: { points: ({ date: string } & Record<WellnessField, number>)[] }) {
  if (points.length < 2) return <p className="note">Todavía no hay suficientes registros de bienestar para ver una tendencia.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="dateLabel" fontSize={12} />
        <YAxis domain={[1, 5]} fontSize={12} />
        <Tooltip />
        <Legend />
        {WELLNESS_FIELDS.map((f, i) => (
          <Line key={f} type="monotone" dataKey={f} name={WELLNESS_FIELD_LABEL[f]} stroke={LINE_PALETTE[i % LINE_PALETTE.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WellnessScoreChart({ points }: { points: { date: string; score: number }[] }) {
  if (points.length < 2) return <p className="note">Todavía no hay suficientes registros de bienestar para ver una tendencia.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="dateLabel" fontSize={12} />
        <YAxis domain={[0, 100]} fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="score" name="Wellness Score" stroke={COLORS.ok} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrainingWeeklyCharts({
  sessionsPerWeek,
  volumePerWeek,
  rpePerWeek,
}: {
  sessionsPerWeek: WeeklyPoint[];
  volumePerWeek: WeeklyPoint[];
  rpePerWeek: WeeklyPoint[];
}) {
  if (sessionsPerWeek.length === 0) return <p className="note">Todavía no hay sesiones completadas en los últimos 90 días.</p>;
  return (
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
  );
}

export interface AssessmentSnapshot {
  id: string;
  date: string;
  typeLabel: string;
  weight: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  circumferences: { site: string; value: number }[];
  skinfoldSum: number | null;
  strength: { exerciseName: string; value: number }[];
}

function deltaText(a: number | null, b: number | null, unit: string): string {
  if (a == null || b == null) return "";
  const d = Math.round((b - a) * 10) / 10;
  if (d === 0) return "sin cambio";
  return `${d > 0 ? "+" : ""}${d} ${unit}`;
}

export function AssessmentComparison({
  options,
  idA,
  idB,
  onChangeA,
  onChangeB,
  snapshotA,
  snapshotB,
}: {
  options: { id: string; label: string }[];
  idA: string;
  idB: string;
  onChangeA: (id: string) => void;
  onChangeB: (id: string) => void;
  snapshotA: AssessmentSnapshot | null;
  snapshotB: AssessmentSnapshot | null;
}) {
  if (options.length < 2) return <p className="note">Hacen falta al menos 2 evaluaciones para comparar.</p>;

  const circSites = snapshotA && snapshotB
    ? [...new Set([...snapshotA.circumferences.map((c) => c.site), ...snapshotB.circumferences.map((c) => c.site)])]
    : [];
  const exercises = snapshotA && snapshotB
    ? [...new Set([...snapshotA.strength.map((s) => s.exerciseName), ...snapshotB.strength.map((s) => s.exerciseName)])]
    : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <label className="field-label">Evaluación A (anterior)</label>
          <select className="input" value={idA} onChange={(e) => onChangeA(e.target.value)}>
            <option value="">Selecciona</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Evaluación B (más reciente)</label>
          <select className="input" value={idB} onChange={(e) => onChangeB(e.target.value)}>
            <option value="">Selecciona</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {snapshotA && snapshotB && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
              <th style={{ padding: "6px 8px" }}></th>
              <th style={{ padding: "6px 8px" }}>{snapshotA.date}</th>
              <th style={{ padding: "6px 8px" }}>{snapshotB.date}</th>
              <th style={{ padding: "6px 8px" }}>Cambio</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 8px" }}>Peso</td>
              <td style={{ padding: "6px 8px" }}>{snapshotA.weight ?? "—"} kg</td>
              <td style={{ padding: "6px 8px" }}>{snapshotB.weight ?? "—"} kg</td>
              <td style={{ padding: "6px 8px" }}>{deltaText(snapshotA.weight, snapshotB.weight, "kg")}</td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 8px" }}>% grasa</td>
              <td style={{ padding: "6px 8px" }}>{snapshotA.bodyFat ?? "—"}%</td>
              <td style={{ padding: "6px 8px" }}>{snapshotB.bodyFat ?? "—"}%</td>
              <td style={{ padding: "6px 8px" }}>{deltaText(snapshotA.bodyFat, snapshotB.bodyFat, "%")}</td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 8px" }}>Masa muscular</td>
              <td style={{ padding: "6px 8px" }}>{snapshotA.muscleMass ?? "—"} kg</td>
              <td style={{ padding: "6px 8px" }}>{snapshotB.muscleMass ?? "—"} kg</td>
              <td style={{ padding: "6px 8px" }}>{deltaText(snapshotA.muscleMass, snapshotB.muscleMass, "kg")}</td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 8px" }}>Σ8 pliegues</td>
              <td style={{ padding: "6px 8px" }}>{snapshotA.skinfoldSum ?? "—"} mm</td>
              <td style={{ padding: "6px 8px" }}>{snapshotB.skinfoldSum ?? "—"} mm</td>
              <td style={{ padding: "6px 8px" }}>{deltaText(snapshotA.skinfoldSum, snapshotB.skinfoldSum, "mm")}</td>
            </tr>
            {circSites.map((site) => {
              const a = snapshotA.circumferences.find((c) => c.site === site)?.value ?? null;
              const b = snapshotB.circumferences.find((c) => c.site === site)?.value ?? null;
              return (
                <tr key={site} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px" }}>{site}</td>
                  <td style={{ padding: "6px 8px" }}>{a ?? "—"} cm</td>
                  <td style={{ padding: "6px 8px" }}>{b ?? "—"} cm</td>
                  <td style={{ padding: "6px 8px" }}>{deltaText(a, b, "cm")}</td>
                </tr>
              );
            })}
            {exercises.map((ex) => {
              const a = snapshotA.strength.find((s) => s.exerciseName === ex)?.value ?? null;
              const b = snapshotB.strength.find((s) => s.exerciseName === ex)?.value ?? null;
              return (
                <tr key={ex} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px" }}>{ex} (1RM est.)</td>
                  <td style={{ padding: "6px 8px" }}>{a ?? "—"} kg</td>
                  <td style={{ padding: "6px 8px" }}>{b ?? "—"} kg</td>
                  <td style={{ padding: "6px 8px" }}>{deltaText(a, b, "kg")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ExerciseProgressChart({
  exerciseOptions,
  exerciseId,
  onExerciseChange,
  series,
}: {
  exerciseOptions: [string, string][];
  exerciseId: string;
  onExerciseChange: (id: string) => void;
  series: { date: string; load: number; reps: number }[];
}) {
  if (exerciseOptions.length === 0) return <p className="note">Este cliente todavía no entrenó ningún ejercicio con carga registrada.</p>;
  return (
    <>
      <select className="input" style={{ maxWidth: 260, marginBottom: 14 }} value={exerciseId} onChange={(e) => onExerciseChange(e.target.value)}>
        {exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      {series.length < 2 ? (
        <p className="note">Hace falta al menos 2 sesiones con este ejercicio para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} />
            <YAxis yAxisId="load" fontSize={12} />
            <YAxis yAxisId="reps" orientation="right" fontSize={12} />
            <Tooltip />
            <Legend />
            <Line yAxisId="load" type="monotone" dataKey="load" name="Carga máxima (kg)" stroke={COLORS.pri} strokeWidth={2} dot />
            <Line yAxisId="reps" type="monotone" dataKey="reps" name="Reps en esa serie" stroke={COLORS.ok} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );
}
