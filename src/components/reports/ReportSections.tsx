import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { WELLNESS_FIELDS, WELLNESS_FIELD_LABEL, type WellnessField } from "../../services/wellness";
import type { WeeklyPoint, ExerciseSummary } from "../../services/reports";
import {
  listProgressPhotos,
  groupPhotosBySession,
  getPhotoUrl,
  ANGLE_LABEL,
  type ProgressPhotoRow,
} from "../../services/progressPhotos";
import Loading from "../ui/Loading";
import SearchSelect from "../ui/SearchSelect";

export const COLORS = { pri: "#1E3FA8", ok: "#2E8B6E", warn: "#B77800", bad: "#D6472B", muted: "#8A93A6", purple: "#7B4FE0" };
const LINE_PALETTE = [COLORS.pri, COLORS.bad, COLORS.ok, COLORS.warn, COLORS.purple];

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });

/**
 * Títulos de los ejes de los gráficos. El eje X lleva espacio extra abajo
 * (height) para que el título no se pise con las fechas ni con la leyenda;
 * los ejes Y, ancho extra (width) para el título vertical.
 */
const AXIS_TITLE = { fontSize: 12, fill: "#5E6A73" };
const xTitle = (value: string) => ({ value, position: "insideBottom" as const, offset: 0, ...AXIS_TITLE });
const yTitle = (value: string, side: "left" | "right" = "left") => ({
  value,
  angle: side === "left" ? -90 : 90,
  position: side === "left" ? ("insideLeft" as const) : ("insideRight" as const),
  style: { textAnchor: "middle" as const },
  ...AXIS_TITLE,
});
const X_H = 44; // alto del eje X con título
const Y_W = 62; // ancho de un eje Y con título
const LEGEND_STYLE = { paddingTop: 6 };

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
        <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
        <YAxis yAxisId="weight" fontSize={12} width={Y_W} label={yTitle("Peso (kg)")} />
        <YAxis yAxisId="fat" orientation="right" fontSize={12} width={Y_W} label={yTitle("Grasa corporal (%)", "right")} />
        <Tooltip />
        <Legend wrapperStyle={LEGEND_STYLE} />
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
  /** [clave, nombre en español] — ver circumferenceKey/circumferenceLabel. */
  siteOptions: [string, string][];
  site: string;
  onSiteChange: (key: string) => void;
  series: CircSeriesPoint[];
}) {
  if (siteOptions.length === 0) return <p className="note">Este cliente todavía no tiene circunferencias registradas en Evaluaciones.</p>;
  return (
    <>
      <SearchSelect className="input" style={{ maxWidth: 240, marginBottom: 14 }} value={site} onChange={(e) => onSiteChange(e.target.value)}>
        {siteOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </SearchSelect>
      {series.length < 2 ? (
        <p className="note">Hacen falta al menos 2 mediciones de esta zona para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
            <YAxis fontSize={12} width={Y_W} label={yTitle(`${siteOptions.find(([k]) => k === site)?.[1] ?? "Circunferencia"} (cm)`)} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="Circunferencia (cm)" stroke={COLORS.pri} strokeWidth={2} dot />
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
        <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
        <YAxis fontSize={12} width={Y_W} label={yTitle("Suma de 8 pliegues (mm)")} />
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
      <SearchSelect className="input" style={{ maxWidth: 260, marginBottom: 14 }} value={exerciseId} onChange={(e) => onExerciseChange(e.target.value)}>
        {exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </SearchSelect>
      {series.length < 2 ? (
        <p className="note">Hace falta al menos 2 pruebas de este ejercicio para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series.map((p) => ({ ...p, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
            <YAxis fontSize={12} width={Y_W} label={yTitle("1RM estimado (kg)")} />
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
        <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
        <YAxis domain={[1, 5]} fontSize={12} width={Y_W} label={yTitle("Puntaje (1 a 5)")} />
        <Tooltip />
        <Legend wrapperStyle={LEGEND_STYLE} />
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
        <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
        <YAxis domain={[0, 100]} fontSize={12} width={Y_W} label={yTitle("Puntaje (0 a 100)")} />
        <Tooltip />
        <Line type="monotone" dataKey="score" name="Puntaje de bienestar" stroke={COLORS.ok} strokeWidth={2} dot={false} />
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
          <XAxis dataKey="weekLabel" fontSize={12} height={X_H} label={xTitle("Semana (lunes)")} />
          <YAxis allowDecimals={false} fontSize={12} width={Y_W} label={yTitle("Sesiones")} />
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
              <XAxis dataKey="weekLabel" fontSize={12} height={X_H} label={xTitle("Semana (lunes)")} />
              <YAxis fontSize={12} width={Y_W} label={yTitle("Volumen (kg)")} />
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
              <XAxis dataKey="weekLabel" fontSize={12} height={X_H} label={xTitle("Semana (lunes)")} />
              <YAxis domain={[0, 10]} fontSize={12} width={Y_W} label={yTitle("RPE (0 a 10)")} />
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
  /** key distingue zona + lado; label es el nombre en español para mostrar. */
  circumferences: { key: string; label: string; value: number }[];
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

  const circSites: [string, string][] = (() => {
    if (!snapshotA || !snapshotB) return [];
    const seen = new Map<string, string>();
    for (const c of [...snapshotA.circumferences, ...snapshotB.circumferences]) if (!seen.has(c.key)) seen.set(c.key, c.label);
    return [...seen.entries()];
  })();
  const exercises = snapshotA && snapshotB
    ? [...new Set([...snapshotA.strength.map((s) => s.exerciseName), ...snapshotB.strength.map((s) => s.exerciseName)])]
    : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <label className="field-label">Evaluación A (anterior)</label>
          <SearchSelect className="input" value={idA} onChange={(e) => onChangeA(e.target.value)}>
            <option value="">Selecciona</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </SearchSelect>
        </div>
        <div>
          <label className="field-label">Evaluación B (más reciente)</label>
          <SearchSelect className="input" value={idB} onChange={(e) => onChangeB(e.target.value)}>
            <option value="">Selecciona</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </SearchSelect>
        </div>
      </div>

      {snapshotA && snapshotB && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
              <th style={{ padding: "6px 8px" }}></th>
              <th style={{ padding: "6px 8px" }}>{fmtFullDate(snapshotA.date)}</th>
              <th style={{ padding: "6px 8px" }}>{fmtFullDate(snapshotB.date)}</th>
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
            {circSites.map(([key, label]) => {
              const a = snapshotA.circumferences.find((c) => c.key === key)?.value ?? null;
              const b = snapshotB.circumferences.find((c) => c.key === key)?.value ?? null;
              return (
                <tr key={key} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px" }}>{label}</td>
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

/** Mini-gráfico de tendencia, en SVG puro (liviano, y sale bien en el PDF). */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 34;
  if (values.length < 2) return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Resumen de todos los ejercicios entrenados: una tarjeta por ejercicio con
 * su tendencia y cuánto cambió desde la primera sesión. Tocar una tarjeta
 * abre ese ejercicio en el gráfico de detalle de abajo.
 *
 * Con carga, la medida es el 1RM estimado (junta peso y reps); sin carga
 * (peso corporal), las reps máximas del día. Un cambio de menos de ±1% se
 * muestra como "estable", para no pintar de rojo una diferencia de redondeo.
 */
export function ExerciseProgressOverview({
  summaries,
  selectedId,
  onSelect,
}: {
  summaries: ExerciseSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  if (summaries.length === 0) return null;
  const shown = showAll ? summaries : summaries.slice(0, LIMIT);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
        {shown.map((x) => {
          const pct = x.pctChange;
          const tone = pct == null ? COLORS.muted : pct > 1 ? COLORS.ok : pct < -1 ? COLORS.bad : COLORS.muted;
          const active = x.exerciseId === selectedId;
          return (
            <button
              key={x.exerciseId}
              type="button"
              onClick={() => onSelect(x.exerciseId)}
              style={{
                textAlign: "left",
                border: `1.5px solid ${active ? COLORS.pri : "var(--line)"}`,
                background: active ? "var(--pri-soft)" : "#fff",
                borderRadius: 10,
                padding: "10px 12px 8px",
                cursor: "pointer",
                font: "inherit",
                color: "var(--ink)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.25, minHeight: 34, overflow: "hidden" }}>{x.exerciseName}</div>
              <Sparkline values={x.series.map((p) => p.value)} color={tone === COLORS.muted ? COLORS.pri : tone} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 13 }}>
                  <b>{fmtNum(x.last)}</b> {x.kind === "load" ? x.unit : "reps"}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>
                  {pct == null ? "" : Math.abs(pct) <= 1 ? "estable" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`}
                </span>
              </div>
              <div className="note" style={{ fontSize: 11.5 }}>
                {x.kind === "load" ? "1RM estimado" : "reps máx."} · {x.sessions} {x.sessions === 1 ? "sesión" : "sesiones"}
              </div>
            </button>
          );
        })}
      </div>
      {summaries.length > LIMIT && (
        <button type="button" className="btn ghost" style={{ marginTop: 10, padding: "6px 12px", fontSize: 13 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Ver menos" : `Ver los ${summaries.length} ejercicios`}
        </button>
      )}
      <p className="note" style={{ fontSize: 12, margin: "10px 0 0" }}>
        El 1RM estimado combina peso y repeticiones (fórmula de Epley): sube tanto si levantó más peso como si hizo más
        repeticiones con el mismo peso. Toca un ejercicio para ver su detalle.
      </p>
    </div>
  );
}

export function ExerciseProgressChart({
  exerciseOptions,
  exerciseId,
  onExerciseChange,
  series,
  unit = "kg",
}: {
  exerciseOptions: [string, string][];
  exerciseId: string;
  onExerciseChange: (id: string) => void;
  series: { date: string; load: number; reps: number; e1rm?: number }[];
  /** Unidad de los valores de series (kg o lb). */
  unit?: "kg" | "lb";
}) {
  if (exerciseOptions.length === 0) return <p className="note">Este cliente todavía no tiene entrenamientos registrados.</p>;
  const hasLoad = series.some((p) => p.load > 0);
  return (
    <>
      <SearchSelect className="input" style={{ maxWidth: 300, marginBottom: 14 }} value={exerciseId} onChange={(e) => onExerciseChange(e.target.value)}>
        {exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </SearchSelect>
      {series.length < 2 ? (
        <p className="note">Hace falta al menos 2 sesiones con este ejercicio para ver una tendencia.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series.map((p) => ({ ...p, e1rm: p.e1rm || null, dateLabel: fmtDate(p.date) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dateLabel" fontSize={12} height={X_H} label={xTitle("Fecha")} />
            {hasLoad && <YAxis yAxisId="load" fontSize={12} width={Y_W} label={yTitle(`Carga y 1RM (${unit})`)} />}
            <YAxis yAxisId="reps" orientation={hasLoad ? "right" : "left"} fontSize={12} allowDecimals={false} width={Y_W} label={yTitle("Repeticiones", hasLoad ? "right" : "left")} />
            <Tooltip />
            <Legend wrapperStyle={LEGEND_STYLE} />
            {hasLoad && <Line yAxisId="load" type="monotone" dataKey="load" name={`Carga máxima (${unit})`} stroke={COLORS.pri} strokeWidth={2} dot />}
            {hasLoad && (
              <Line yAxisId="load" type="monotone" dataKey="e1rm" name={`1RM estimado (${unit})`} stroke={COLORS.purple} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            )}
            <Line yAxisId="reps" type="monotone" dataKey="reps" name={hasLoad ? "Reps en esa serie" : "Reps máximas"} stroke={COLORS.ok} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </>
  );
}
