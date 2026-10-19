import { useEffect, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import Chip from "./ui/Chip";
import {
  getTodayLog,
  upsertTodayLog,
  wellnessScore,
  wellnessSemaforo,
  lowFields,
  WELLNESS_FIELDS,
  WELLNESS_FIELD_LABEL,
  WELLNESS_SCALE_HINT,
  type WellnessField,
  type WellnessLogRow,
} from "../services/wellness";
import Loading from "./ui/Loading";

export default function WellnessForm({
  clientId,
  onSubmitted,
  submitLabel = "Enviar",
  intro,
}: {
  clientId: string;
  onSubmitted: (log: WellnessLogRow) => void;
  submitLabel?: string;
  intro?: string;
}) {
  const { notify } = useToast();
  const [sleepHours, setSleepHours] = useState("");
  const [values, setValues] = useState<Record<WellnessField, number>>({ sleep_quality: 3, fatigue: 3, energy: 3, stress: 3, soreness: 3 });
  const [painLocation, setPainLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [existing, setExisting] = useState<WellnessLogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTodayLog(clientId)
      .then((today) => {
        setExisting(today);
        if (today) {
          setSleepHours(today.sleep_hours != null ? String(today.sleep_hours) : "");
          setValues({ sleep_quality: today.sleep_quality, fatigue: today.fatigue, energy: today.energy, stress: today.stress, soreness: today.soreness });
          setPainLocation(today.pain_location ?? "");
          setNotes(today.notes ?? "");
        }
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const score = wellnessScore(values);
  const semaforo = wellnessSemaforo(score);
  const flagged = lowFields(values);

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await upsertTodayLog(clientId, {
        sleep_hours: sleepHours ? Number(sleepHours.replace(",", ".")) : null,
        ...values,
        pain_location: painLocation,
        notes,
      });
      onSubmitted(saved);
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <div>
      {intro && <p className="note" style={{ marginBottom: 20 }}>{intro}</p>}

      <div style={{ marginBottom: 18 }}>
        <label className="field-label">Horas de sueño</label>
        <input className="input" style={{ maxWidth: 120 }} value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="Ej. 7.5" />
      </div>

      {WELLNESS_FIELDS.map((f) => (
        <div key={f} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>{WELLNESS_FIELD_LABEL[f]}</label>
            <b>{values[f]}</b>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={values[f]}
            onChange={(e) => setValues((v) => ({ ...v, [f]: Number(e.target.value) }))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="note" style={{ fontSize: 12 }}>{WELLNESS_SCALE_HINT[f].low}</span>
            <span className="note" style={{ fontSize: 12 }}>{WELLNESS_SCALE_HINT[f].high}</span>
          </div>
        </div>
      ))}

      <label className="field-label">Localización del dolor (si corresponde)</label>
      <input className="input" style={{ marginBottom: 16 }} value={painLocation} onChange={(e) => setPainLocation(e.target.value)} placeholder="Ej. Isquiotibial derecho" />

      <label className="field-label">Comentarios (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Wellness Score: <b>{score}</b> / 100</span>
          <Chip tone={semaforo.tone}>{semaforo.emoji} {semaforo.label}</Chip>
        </div>
        {flagged.length > 0 && (
          <p className="note" style={{ marginTop: 8 }}>
            Atención puntual en: {flagged.map((f) => WELLNESS_FIELD_LABEL[f]).join(", ")}.
          </p>
        )}
      </div>

      <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={saving}>
        {saving ? "Guardando…" : existing ? "Actualizar y continuar" : submitLabel}
      </button>
    </div>
  );
}
