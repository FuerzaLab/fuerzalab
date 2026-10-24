import { useEffect, useState } from "react";
import {
  listAssessments,
  getBodyMeasurement,
  listCircumferences,
  listSkinfolds,
  listStrengthTests,
  sumSkinfolds8,
  TYPE_LABEL,
  type CircumferenceSite,
  type StrengthTestRow,
} from "../services/assessments";
import { listRecentLogs, wellnessScore, WELLNESS_FIELDS, type WellnessField } from "../services/wellness";
import {
  listWorkoutLogsForClient,
  listSetLogsForClient,
  listExerciseSetsForClient,
  dailyTopLoad,
  weeklyCompletedSessions,
  weeklyAvgRPE,
  weeklyVolume,
  type WeeklyPoint,
} from "../services/reports";
import type { AssessmentSnapshot, BodyPoint, PersonalRecord } from "../components/reports/ReportSections";

export interface ClientReportData {
  loading: boolean;
  snapshots: AssessmentSnapshot[];
  bodyPoints: BodyPoint[];
  circSiteOptions: CircumferenceSite[];
  circSeriesFor: (site: CircumferenceSite) => { date: string; value: number }[];
  skinfoldPoints: { date: string; sum: number }[];
  strengthExerciseOptions: [string, string][];
  strengthSeriesFor: (exerciseId: string) => { date: string; value: number }[];
  personalRecords: PersonalRecord[];
  wellnessScorePoints: { date: string; score: number }[];
  wellnessBreakdownPoints: ({ date: string } & Record<WellnessField, number>)[];
  sessionsPerWeek: WeeklyPoint[];
  volumePerWeek: WeeklyPoint[];
  rpePerWeek: WeeklyPoint[];
  exerciseProgressOptions: [string, string][];
  exerciseProgressFor: (exerciseId: string) => { date: string; load: number; reps: number }[];
}

/** Junta todo lo que necesitan las pantallas de Reportes (del entrenador y del cliente) a partir del id del cliente. */
export function useClientReportData(clientId: string | null): ClientReportData {
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<AssessmentSnapshot[]>([]);
  const [strengthRaw, setStrengthRaw] = useState<(StrengthTestRow & { date: string })[]>([]);
  const [wellnessRaw, setWellnessRaw] = useState<({ date: string } & Record<WellnessField, number> & { score: number })[]>([]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<WeeklyPoint[]>([]);
  const [volumePerWeek, setVolumePerWeek] = useState<WeeklyPoint[]>([]);
  const [rpePerWeek, setRpePerWeek] = useState<WeeklyPoint[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Awaited<ReturnType<typeof listExerciseSetsForClient>>>([]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    (async () => {
      const assessments = await listAssessments(clientId);
      const snaps: AssessmentSnapshot[] = [];
      const strengthRows: (StrengthTestRow & { date: string })[] = [];
      for (const a of assessments) {
        const [body, circs, skinfolds, strength] = await Promise.all([
          getBodyMeasurement(a.id),
          listCircumferences(a.id),
          listSkinfolds(a.id),
          listStrengthTests(a.id),
        ]);
        const sigma8 = sumSkinfolds8(skinfolds);
        snaps.push({
          id: a.id,
          date: a.assessed_at,
          typeLabel: TYPE_LABEL[a.type],
          weight: body?.weight_kg ?? null,
          bodyFat: body?.body_fat_pct ?? null,
          muscleMass: body?.muscle_mass_kg ?? null,
          circumferences: circs.map((c) => ({ site: c.site, value: c.value_cm })),
          skinfoldSum: sigma8.complete ? sigma8.sum : null,
          strength: strength.map((s) => ({ exerciseName: s.exercise_name ?? "", value: s.estimated_1rm })),
        });
        for (const s of strength) strengthRows.push({ ...s, date: a.assessed_at });
      }
      snaps.sort((x, y) => x.date.localeCompare(y.date));
      strengthRows.sort((x, y) => x.date.localeCompare(y.date));
      setSnapshots(snaps);
      setStrengthRaw(strengthRows);

      const wlogs = await listRecentLogs(clientId, 180);
      const wRows = wlogs
        .map((l) => ({
          date: l.log_date,
          score: wellnessScore(l),
          sleep_quality: l.sleep_quality,
          fatigue: l.fatigue,
          energy: l.energy,
          stress: l.stress,
          soreness: l.soreness,
        }))
        .sort((x, y) => x.date.localeCompare(y.date));
      setWellnessRaw(wRows);

      const [workoutLogs, setLogs, exSets] = await Promise.all([
        listWorkoutLogsForClient(clientId, 90),
        listSetLogsForClient(clientId, 90),
        listExerciseSetsForClient(clientId, 180),
      ]);
      setSessionsPerWeek(weeklyCompletedSessions(workoutLogs));
      setRpePerWeek(weeklyAvgRPE(workoutLogs));
      setVolumePerWeek(weeklyVolume(setLogs));
      setExerciseSets(exSets);

      setLoading(false);
    })();
  }, [clientId]);

  const bodyPoints: BodyPoint[] = snapshots
    .filter((s) => s.weight != null || s.bodyFat != null)
    .map((s) => ({ date: s.date, weight: s.weight, bodyFat: s.bodyFat }));

  const circSiteOptions = [...new Set(snapshots.flatMap((s) => s.circumferences.map((c) => c.site)))] as CircumferenceSite[];
  const circSeriesFor = (site: CircumferenceSite) =>
    snapshots.filter((s) => s.circumferences.some((c) => c.site === site)).map((s) => ({ date: s.date, value: s.circumferences.find((c) => c.site === site)!.value }));

  const skinfoldPoints = snapshots.filter((s) => s.skinfoldSum != null).map((s) => ({ date: s.date, sum: s.skinfoldSum! }));

  const strengthExerciseOptions: [string, string][] = (() => {
    const seen = new Map<string, string>();
    for (const t of strengthRaw) seen.set(t.exercise_id, t.exercise_name ?? "");
    return [...seen.entries()];
  })();
  const strengthSeriesFor = (exerciseId: string) =>
    strengthRaw.filter((t) => t.exercise_id === exerciseId).map((t) => ({ date: t.date, value: t.estimated_1rm }));

  const personalRecords: PersonalRecord[] = (() => {
    const best = new Map<string, PersonalRecord>();
    for (const t of strengthRaw) {
      const current = best.get(t.exercise_id);
      if (!current || t.estimated_1rm > current.best1RM) {
        best.set(t.exercise_id, { exerciseId: t.exercise_id, exerciseName: t.exercise_name ?? "", best1RM: t.estimated_1rm, date: t.date });
      }
    }
    return [...best.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  })();

  const wellnessScorePoints = wellnessRaw.map((w) => ({ date: w.date, score: w.score }));
  const wellnessBreakdownPoints = wellnessRaw.map((w) => {
    const row: any = { date: w.date };
    for (const f of WELLNESS_FIELDS) row[f] = w[f];
    return row;
  });

  const exerciseProgressOptions: [string, string][] = (() => {
    const seen = new Map<string, string>();
    for (const e of exerciseSets) seen.set(e.exercise_id, e.exercise_name);
    return [...seen.entries()];
  })();
  const exerciseProgressFor = (exerciseId: string) => dailyTopLoad(exerciseSets.filter((e) => e.exercise_id === exerciseId));

  return {
    loading,
    snapshots,
    bodyPoints,
    circSiteOptions,
    circSeriesFor,
    skinfoldPoints,
    strengthExerciseOptions,
    strengthSeriesFor,
    personalRecords,
    wellnessScorePoints,
    wellnessBreakdownPoints,
    sessionsPerWeek,
    volumePerWeek,
    rpePerWeek,
    exerciseProgressOptions,
    exerciseProgressFor,
  };
}
