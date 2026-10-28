import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import IntakeFormView from "../../../components/IntakeFormView";
import { exportReportPdf } from "../../../lib/exportReportPdf";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Modal from "../../../components/ui/Modal";
import Chip from "../../../components/ui/Chip";
import {
  getClient,
  getClientProfile,
  upsertClientProfile,
  updateClientStatus,
  approveIntake,
  resetOnboarding,
  getClientDeleteBlockers,
  deleteClient,
  listClientNotes,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  getLastSignInByProfileId,
  PAR_Q_QUESTIONS,
  type ClientRow,
  type ClientProfileRow,
  type ClientStatus,
  type ClientNoteRow,
} from "../../../services/clients";
import { paths } from "../../../routes/paths";
import Loading from "../../../components/ui/Loading";
import { normalizeHeightCm, parseHeightCm } from "../../../services/assessments";

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
  const { profile } = useAuth();
  const isTrainer = profile?.role === "trainer";
  const [showIntake, setShowIntake] = useState(false);
  const [exportingIntake, setExportingIntake] = useState(false);
  const intakeRef = useRef<HTMLDivElement>(null);

  const [client, setClient] = useState<ClientRow | null>(null);
  const [intake, setIntake] = useState<ClientProfileRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toArchive, setToArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

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
        setIntake(p);
        if (p) setForm(profileToForm(p));
        if (c.profile_id) {
          const map = await getLastSignInByProfileId([c.profile_id]);
          if (!cancelled) setLastSignIn(map[c.profile_id] ?? null);
        }
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

  if (loading) return <div className="page"><Loading /></div>;
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
          {!client.profile_id && <Chip tone="warn">Sin aceptar invitación</Chip>}
          {client.profile_id && (
            <span className="note">{lastSignIn ? `Último ingreso: ${new Date(lastSignIn).toLocaleDateString("es")}` : "Todavía no ingresó"}</span>
          )}
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
          {/* Eliminar un cliente por completo es solo del entrenador; el staff puede "Dar de baja", que conserva todo. */}
          {isTrainer && (
            <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={() => setShowDelete(true)}>
              Eliminar
            </button>
          )}
        </div>
      </div>

      {!intake?.submitted_at ? (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="bd">
            <p className="note">{client.full_name} todavía no completó su formulario de ingreso.</p>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="hd">
            <h3>Formulario de ingreso</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn ghost" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setShowIntake(true)}>
                Ver formulario completo
              </button>
              {intake.reviewed_at && <Chip tone="ok">Revisado</Chip>}
              {!intake.reviewed_at && (
                <button
                  className="btn"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                  onClick={async () => {
                    await approveIntake(client.id);
                    setIntake((i) => (i ? { ...i, reviewed_at: new Date().toISOString() } : i));
                    notify(`Ingreso de ${client.full_name} aprobado. Ya puede ver el resto de la app.`);
                  }}
                >
                  Aprobar ingreso
                </button>
              )}
              <button
                className="btn ghost"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={async () => {
                  await resetOnboarding(client.id);
                  setIntake((i) => (i ? { ...i, submitted_at: null, reviewed_at: null } : i));
                  notify(`Se le pidió a ${client.full_name} que vuelva a completar el formulario. Va a ver el formulario bloqueado otra vez al entrar.`);
                }}
              >
                Solicitar que lo vuelva a completar
              </button>
            </div>
          </div>
          <div className="bd">
            {PAR_Q_QUESTIONS.some((q) => intake.par_q?.[q.key]) && (
              <div style={{ borderLeft: "4px solid var(--bad)", background: "var(--bad-soft)", padding: "10px 14px", borderRadius: 6, marginBottom: 16 }}>
                <b>Señales de salud a revisar antes de armar el plan:</b>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {PAR_Q_QUESTIONS.filter((q) => intake.par_q?.[q.key]).map((q) => (
                    <li key={q.key}>{q.text}</li>
                  ))}
                </ul>
                {intake.par_q?.otherDetail && <p style={{ marginTop: 6 }}>Detalle: {intake.par_q.otherDetail}</p>}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
              <div><span className="note">Objetivo principal</span><div>{intake.main_goal || "—"}</div></div>
              <div><span className="note">Objetivos secundarios</span><div>{intake.secondary_goals.length ? intake.secondary_goals.join(", ") : "—"}</div></div>
              <div><span className="note">Peso</span><div>{intake.weight_kg ? `${intake.weight_kg} kg` : "—"}</div></div>
              <div><span className="note">Sueño</span><div>{intake.habits?.sleepHours ? `${intake.habits.sleepHours} h/noche` : "—"}</div></div>
              <div><span className="note">Actividad diaria</span><div>{intake.habits?.activityLevel || "—"}</div></div>
              <div><span className="note">Alimentación</span><div>{intake.habits?.nutritionQuality || "—"}</div></div>
              <div><span className="note">Estrés habitual</span><div>{intake.habits?.stressLevel || "—"}</div></div>
              <div><span className="note">Días disponibles</span><div>{intake.preferences?.trainingDays || "—"}</div></div>
              <div><span className="note">Duración preferida</span><div>{intake.preferences?.sessionDuration || "—"}</div></div>
              <div><span className="note">Equipamiento disponible</span><div>{intake.preferences?.equipmentAccess || "—"}</div></div>
              <div><span className="note">Horario preferido</span><div>{intake.preferences?.preferredTime || "—"}</div></div>
            </div>
            {intake.medical_notes && (
              <div style={{ marginBottom: 10 }}>
                <span className="note">Medicamentos, alergias o condiciones</span>
                <div>{intake.medical_notes}</div>
              </div>
            )}
            {intake.emergency_contact?.name && (
              <div style={{ marginBottom: 10 }}>
                <span className="note">Contacto de emergencia</span>
                <div>{intake.emergency_contact.name}{intake.emergency_contact.relationship ? ` (${intake.emergency_contact.relationship})` : ""}{intake.emergency_contact.phone ? ` — ${intake.emergency_contact.phone}` : ""}</div>
              </div>
            )}
            <p className="note">Completado el {new Date(intake.submitted_at).toLocaleDateString("es")}.</p>
          </div>
        </div>
      )}

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
              <input className="input" inputMode="decimal" placeholder="Ej. 165" value={form.height_cm} onChange={(e) => patch("height_cm", e.target.value)} />
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

      <ClientNotesPanel clientId={client.id} organizationId={client.organization_id} trainerId={client.trainer_id} />

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

      {showIntake && intake && (
        <Modal title="Formulario de ingreso" onClose={() => setShowIntake(false)} wide>
          <div ref={intakeRef}>
            <IntakeFormView data={intake} clientName={client.full_name} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button
              className="btn"
              disabled={exportingIntake}
              onClick={async () => {
                if (!intakeRef.current) return;
                setExportingIntake(true);
                try {
                  await exportReportPdf(intakeRef.current, `Formulario de ingreso - ${client.full_name}.pdf`);
                } catch (e: any) {
                  notify("No pudimos generar el PDF: " + e.message);
                }
                setExportingIntake(false);
              }}
            >
              {exportingIntake ? "Generando…" : "Descargar en PDF"}
            </button>
            <button className="btn ghost" onClick={() => setShowIntake(false)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {showDelete && (
        <DeleteClientModal
          client={client}
          onClose={() => setShowDelete(false)}
          onDeleted={() => navigate(paths.trainerClients)}
        />
      )}
    </div>
  );
}

function profileToForm(p: ClientProfileRow): FormState {
  return {
    birth_date: p.birth_date ?? "",
    sex: p.sex ?? "",
    height_cm: p.height_cm != null ? String(normalizeHeightCm(p.height_cm)) : "", // si se cargó en metros, se muestra en cm
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
    height_cm: f.height_cm ? parseHeightCm(f.height_cm) : null,
    training_level: (f.training_level || null) as ClientProfileRow["training_level"],
    sports_history: f.sports_history || null,
    injuries: f.injuries || null,
    medical_notes: f.medical_notes || null,
  };
}

function DeleteClientModal({ client, onClose, onDeleted }: { client: ClientRow; onClose: () => void; onDeleted: () => void }) {
  const { notify } = useToast();
  const [blockers, setBlockers] = useState<{ programs: number; plans: number } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getClientDeleteBlockers(client.id).then(setBlockers).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = blockers !== null && (blockers.programs > 0 || blockers.plans > 0);

  const submit = async () => {
    if (confirmText.trim() !== client.full_name) {
      setError("El nombre no coincide. Escríbelo exactamente igual para confirmar.");
      return;
    }
    setError("");
    setDeleting(true);
    try {
      await deleteClient(client.id);
      notify(`${client.full_name} fue eliminado.`);
      onDeleted();
    } catch (e: any) {
      setError(e.message ?? "No pudimos eliminar este cliente.");
      setDeleting(false);
    }
  };

  return (
    <Modal title={`Eliminar a ${client.full_name}`} onClose={onClose}>
      {blockers === null ? (
        <p className="note">Comprobando…</p>
      ) : blocked ? (
        <p>
          Este cliente todavía tiene {blockers.programs > 0 && <>{" "}<b>{blockers.programs}</b> programa{blockers.programs === 1 ? "" : "s"} (con sus rutinas)</>}
          {blockers.programs > 0 && blockers.plans > 0 && " y"}
          {blockers.plans > 0 && <>{" "}<b>{blockers.plans}</b> plan{blockers.plans === 1 ? "" : "es"} de pago</>}. No se puede
          eliminar mientras tenga algo de eso — primero elimina sus programas desde Planificación, o usa "Dar de baja" en
          vez de eliminarlo, que conserva todo su historial.
        </p>
      ) : (
        <>
          <p style={{ marginBottom: 14 }}>
            Esta acción es <b>permanente</b> y no se puede deshacer. No tiene programas ni planes de pago, así que es
            segura, pero confírmala escribiendo el nombre exacto del cliente:
          </p>
          <p className="note" style={{ marginBottom: 6 }}><b>{client.full_name}</b></p>
          <input className="input" style={{ marginBottom: 12 }} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn" style={{ background: "var(--bad)", borderColor: "var(--bad)" }} onClick={submit} disabled={deleting}>
            {deleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </>
      )}
    </Modal>
  );
}

function ClientNotesPanel({ clientId, organizationId, trainerId }: { clientId: string; organizationId: string; trainerId: string }) {
  const { notify } = useToast();
  const [notes, setNotes] = useState<ClientNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  useEffect(() => {
    listClientNotes(clientId)
      .then(setNotes)
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const add = async () => {
    if (!newBody.trim()) return;
    setSaving(true);
    try {
      const created = await createClientNote({ organizationId, trainerId, clientId, body: newBody.trim() });
      setNotes((ns) => [created, ...ns]);
      setNewBody("");
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="hd">
        <h3>Notas privadas</h3>
      </div>
      <div className="bd">
        <p className="note" style={{ marginBottom: 14 }}>
          Solo las ves tú (y tu equipo, si tiene permiso) — el cliente nunca tiene acceso a esta sección.
        </p>
        <textarea
          className="input"
          style={{ minHeight: 60, marginBottom: 10 }}
          placeholder="Ej. Llegó tarde dos veces esta semana, revisar horario."
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
        />
        <button className="btn" onClick={add} disabled={saving || !newBody.trim()} style={{ marginBottom: 18 }}>
          {saving ? "Guardando…" : "Agregar nota"}
        </button>

        {loading ? (
          <Loading />
        ) : notes.length === 0 ? (
          <p className="note">Todavía no hay notas cargadas.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div className="note" style={{ marginBottom: 4 }}>{new Date(n.created_at).toLocaleString("es")}</div>
                {editingId === n.id ? (
                  <>
                    <textarea className="input" style={{ minHeight: 50, marginBottom: 8 }} value={editingBody} onChange={(e) => setEditingBody(e.target.value)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12.5 }}
                        onClick={async () => {
                          await updateClientNote(n.id, editingBody.trim());
                          setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, body: editingBody.trim() } : x)));
                          setEditingId(null);
                        }}
                      >
                        Guardar
                      </button>
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{n.body}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12.5 }}
                        onClick={() => {
                          setEditingId(n.id);
                          setEditingBody(n.body);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12.5, color: "var(--bad)" }}
                        onClick={async () => {
                          await deleteClientNote(n.id);
                          setNotes((ns) => ns.filter((x) => x.id !== n.id));
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
