import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import {
  createExercise,
  GOAL_OPTIONS,
  type CatalogItem,
  type ExerciseRow,
  type NewExerciseInput,
} from "../../../services/exercises";

export default function NewExerciseModal({
  scope,
  organizationId,
  ownerId,
  muscles,
  patterns,
  equipment,
  onClose,
  onCreated,
}: {
  scope: "global" | "trainer";
  organizationId: string | null;
  ownerId: string | null;
  muscles: CatalogItem[];
  patterns: CatalogItem[];
  equipment: CatalogItem[];
  onClose: () => void;
  onCreated: (ex: ExerciseRow) => void;
}) {
  const [name, setName] = useState("");
  const [muscleId, setMuscleId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [equipIds, setEquipIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<NewExerciseInput["difficulty"]>("intermediate");
  const [goals, setGoals] = useState<string[]>([]);
  const [cues, setCues] = useState("");
  const [mistakes, setMistakes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleEquip = (id: string) =>
    setEquipIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const toggleGoal = (g: string) => setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));

  const submit = async () => {
    if (!name.trim()) {
      setError("Escribe un nombre para poder crear el ejercicio.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const created = await createExercise(
        {
          name: name.trim(),
          primary_muscle_id: muscleId || null,
          movement_pattern_id: patternId || null,
          equipment_ids: equipIds,
          difficulty,
          goals: goals.length ? goals : ["Fuerza"],
          instructions: "",
          technical_cues: cues,
          common_mistakes: mistakes,
        },
        scope,
        organizationId,
        ownerId
      );
      onCreated(created);
    } catch (err: any) {
      setError(err.message ?? "No pudimos crear el ejercicio.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nuevo ejercicio" onClose={onClose} wide>
      <label className="field-label">Nombre del ejercicio</label>
      <input
        className={`input${error && !name.trim() ? " error" : ""}`}
        style={{ marginBottom: 12 }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Zancada búlgara"
        autoFocus
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Grupo muscular</label>
          <select className="input" value={muscleId} onChange={(e) => setMuscleId(e.target.value)}>
            <option value="">Selecciona</option>
            {muscles.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Patrón de movimiento</label>
          <select className="input" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
            <option value="">Selecciona</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Nivel</label>
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as NewExerciseInput["difficulty"])}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>
      </div>

      <label className="field-label">Equipamiento</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {equipment.map((eq) => (
          <button
            key={eq.id}
            type="button"
            onClick={() => toggleEquip(eq.id)}
            className="chip"
            style={{
              cursor: "pointer",
              border: "1px solid var(--line)",
              background: equipIds.includes(eq.id) ? "var(--pri)" : "#fff",
              color: equipIds.includes(eq.id) ? "#fff" : "var(--muted)",
            }}
          >
            {eq.label}
          </button>
        ))}
      </div>

      <label className="field-label">Objetivos de entrenamiento</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {GOAL_OPTIONS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggleGoal(g)}
            className="chip"
            style={{
              cursor: "pointer",
              border: "1px solid var(--line)",
              background: goals.includes(g) ? "var(--pri)" : "#fff",
              color: goals.includes(g) ? "#fff" : "var(--muted)",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      <label className="field-label">Indicaciones técnicas</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 12 }} value={cues} onChange={(e) => setCues(e.target.value)} />

      <label className="field-label">Errores frecuentes</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={mistakes} onChange={(e) => setMistakes(e.target.value)} />

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>
        {saving ? "Creando…" : "Crear ejercicio"}
      </button>
    </Modal>
  );
}
