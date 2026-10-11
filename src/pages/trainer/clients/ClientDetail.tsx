import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import {
  getClient,
  getClientProfile,
  upsertClientProfile,
  updateClientStatus,
  type ClientRow,
  type ClientProfileRow,
  type ClientStatus,
} from "../../../services/clients";
import { paths } from "../../../routes/paths";

const STATUS_LABEL: Record<ClientStatus, string> = {
  prospect: "Prospecto",
  active: "Activo",
  paused: "En pausa",
  archived: "Dado de baja",
};
const STATUS_TONE: Record<ClientStatus, "ok" | "warn" | "bad" | ""> = {
  prospect: "",
  active: "ok",
  paused: "warn",
  archived: "bad",
};

type FormState = {
  birth_date: string;
  sex: string;
  height_cm: string;
  training_level: string;
  sports_history: string;
  injuries: string;
  medical_notes: string;
};

const EMPTY_FORM: FormState = {
  birth_date: "",
  sex: "",
  height_cm: "",
  training_level: "",
  sports_history: "",
  injuries: "",
  medical_notes: "",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [client, setClient] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toArchive, setToArchive] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [c, p] = await Promise.all([getClient(id), getClientProfile(id)]);
        if (cancelled) return;
        setClient(c);
        if (p) setForm(profileToForm(p));
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message ?? "No pudimos cargar este cliente.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const patch = (field: keyof FormState, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const changeStatus = async (status: ClientStatus) => {
    if (!client) return;
    try {
      await updateClientStatus(client.id, status);
      setClient({ ...client, status });
      notify(`Ahora está "${STATUS_LABEL[status]}".`);
    } catch (err: any) {
      notify(`No se pudo actualizar: ${err.message}`);
    }
  };

  const save = async () => {
    if (!client) return;
    setSaving(true);
    try {
      await upsertClientProfile(client.id, formToProfile(form));
      notify("Ficha guardada.");
    } catch (err: any) {
      notify(`No se pudo guardar: ${err.message}`);
    }
    setSaving(false);
  };

  if (loading) return <div className="page"><p className="note">Cargando…</p></div>;
  if (loadError || !client) {
    return (
      <div className="page">
        <p className="error-text">{loadError || "No encontramos este cliente."}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <button
        onClick={() => navigate(paths.trainerClients)}
        style={{ border: 0, background: "none", color: "var(--pri)", padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
      >
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{client.full_name}</h1>
          <p className="note">{client.email || "Sin correo registrado"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Chip tone={STATUS_TONE[client.status]}>{STATUS_LABEL[client.status]}</Chip>
          {client.status !== "active" && (
            <button className="btn ghost" onClick={() => changeStatus("active")}>Reactivar</button>
          )}
          {client.status === "active" && (
            <button className="btn ghost" onClick={() => changeStatus("paused")}>Suspender</button>
          )}
          {client.status !== "archived" && (
            <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={() => setToArchive(true)}>
              Dar de baja
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h3>Ficha del cliente</h3>
        </div>
        <div className="bd">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="field-label">Fecha de nacimiento</label>
              <input type="date" className="input" value={form.birth_date} onChange={(e) => patch("birth_date", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Sexo</label>
              <select className="input" value={form.sex} onChange={(e) => patch("sex", e.target.value)}>
                <option value="">Selecciona</option>
                <option value="female">Femenino</option>
                <option value="male">Masculino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="field-label">Estatura (cm)</label>
              <input className="input" inputMode="decimal" value={form.height_cm} onChange={(e) => patch("height_cm", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Nivel de experiencia</label>
              <select className="input" value={form.training_level} onChange={(e) => patch("training_level", e.target.value)}>
                <option value="">Selecciona</option>
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
                <option value="elite">Élite</option>
              </select>
            </div>
          </div>

          <label className="field-label">Historial deportivo</label>
          <textarea className="input" style={{ minHeight: 70, marginBottom: 14 }} value={form.sports_history} onChange={(e) => patch("sports_history", e.target.value)} />

          <label className="field-label">Lesiones o molestias</label>
          <textarea className="input" style={{ minHeight: 70, marginBottom: 14 }} value={form.injuries} onChange={(e) => patch("injuries", e.target.value)} />

          <label className="field-label">Notas médicas</label>
          <textarea className="input" style={{ minHeight: 70, marginBottom: 16 }} value={form.medical_notes} onChange={(e) => patch("medical_notes", e.target.value)} />

          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar ficha"}
          </button>
        </div>
      </div>

      {toArchive && (
        <ConfirmModal
          title="Dar de baja"
          message={`¿Dar de baja a ${client.full_name}? Su historial se conserva y no podrá entrar a la plataforma.`}
          confirmLabel="Dar de baja"
          danger
          onClose={() => setToArchive(false)}
          onConfirm={async () => {
            await changeStatus("archived");
            setToArchive(false);
          }}
        />
      )}
    </div>
  );
}

function profileToForm(p: ClientProfileRow): FormState {
  return {
    birth_date: p.birth_date ?? "",
    sex: p.sex ?? "",
    height_cm: p.height_cm != null ? String(p.height_cm) : "",
    training_level: p.training_level ?? "",
    sports_history: p.sports_history ?? "",
    injuries: p.injuries ?? "",
    medical_notes: p.medical_notes ?? "",
  };
}

function formToProfile(f: FormState) {
  return {
    birth_date: f.birth_date || null,
    sex: (f.sex || null) as ClientProfileRow["sex"],
    height_cm: f.height_cm ? Number(f.height_cm) : null,
    training_level: (f.training_level || null) as ClientProfileRow["training_level"],
    sports_history: f.sports_history || null,
    injuries: f.injuries || null,
    medical_notes: f.medical_notes || null,
  };
}
