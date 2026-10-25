import { useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Loading from "../../../components/ui/Loading";
import { listClients, type ClientRow } from "../../../services/clients";
import { listTemplates, deleteProgram, listWeeks, METHOD_LABEL, type ProgramRow, type WeekRow } from "../../../services/programs";
import { cloneProgram, listSessions } from "../../../services/sessions";
import { getActiveProgramForClient } from "../../../services/training";
import {
  listWorkoutTemplates,
  deleteWorkoutTemplate,
  listTemplateSessions,
  applyTemplateDayToWeek,
  type WorkoutTemplateRow,
  type WorkoutTemplateSessionRow,
} from "../../../services/templates";
import SearchSelect from "../../../components/ui/SearchSelect";

export default function TemplatesPage() {
  const { profile, actingTrainerId } = useAuth();
  const { notify } = useToast();
  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [looseTemplates, setLooseTemplates] = useState<WorkoutTemplateRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<ProgramRow | null>(null);
  const [deleting, setDeleting] = useState<ProgramRow | null>(null);
  const [deletingLoose, setDeletingLoose] = useState<WorkoutTemplateRow | null>(null);
  const [applyingDay, setApplyingDay] = useState<{ template: WorkoutTemplateRow; day: WorkoutTemplateSessionRow } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [t, lt, c] = await Promise.all([listTemplates(), listWorkoutTemplates(), listClients()]);
      setTemplates(t);
      setLooseTemplates(lt);
      setClients(c);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Plantillas</h1>

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Programas completos</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        Programas guardados sin un cliente asignado, con todas sus semanas y bloques. Para crear uno, andá a Planificación con un cliente, armá el programa como quieras, y tocá "Guardar como plantilla".
      </p>

      {loading ? (
        <Loading />
      ) : templates.length === 0 ? (
        <p className="note">Todavía no guardaste ninguna plantilla.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {templates.map((t) => (
            <div key={t.id} className="panel">
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <b>{t.name}</b>
                  <div className="note">{METHOD_LABEL[t.method]}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => setApplyingTo(t)}>Usar con un cliente</button>
                  <button className="btn ghost" onClick={() => setDeleting(t)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 4, marginTop: 28 }}>Rutinas sueltas</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        Días de entrenamiento guardados por separado — útil para un split que usás con varios clientes, sin tener que armarlo entero cada vez. Para crear uno, andá al Constructor de rutinas y tocá "Guardar como plantilla" sobre la rutina que tengas abierta.
      </p>

      {loading ? null : looseTemplates.length === 0 ? (
        <p className="note">Todavía no guardaste ninguna rutina suelta.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {looseTemplates.map((t) => (
            <LooseTemplateCard key={t.id} template={t} onDelete={() => setDeletingLoose(t)} onApplyDay={(day) => setApplyingDay({ template: t, day })} />
          ))}
        </div>
      )}

      {applyingTo && (
        <ApplyTemplateModal
          template={applyingTo}
          clients={clients}
          organizationId={profile.organization_id!}
          trainerId={(actingTrainerId ?? profile.id)}
          onClose={() => setApplyingTo(null)}
          onApplied={() => {
            setApplyingTo(null);
            notify("Plantilla aplicada. Elegí a ese cliente en Planificación para ajustar lo que haga falta.");
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar plantilla"
          message={`¿Eliminar "${deleting.name}"? Los programas ya creados a partir de esta plantilla no se ven afectados.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteProgram(deleting.id);
            setTemplates((ts) => ts.filter((t) => t.id !== deleting.id));
            setDeleting(null);
            notify("Plantilla eliminada.");
          }}
        />
      )}

      {deletingLoose && (
        <ConfirmModal
          title="Eliminar rutina suelta"
          message={`¿Eliminar "${deletingLoose.name}" y todos sus días? Las rutinas ya aplicadas a algún cliente no se ven afectadas.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setDeletingLoose(null)}
          onConfirm={async () => {
            await deleteWorkoutTemplate(deletingLoose.id);
            setLooseTemplates((ts) => ts.filter((t) => t.id !== deletingLoose.id));
            setDeletingLoose(null);
            notify("Rutina suelta eliminada.");
          }}
        />
      )}

      {applyingDay && (
        <ApplyTemplateDayModal
          day={applyingDay.day}
          clients={clients}
          onClose={() => setApplyingDay(null)}
          onApplied={() => {
            setApplyingDay(null);
            notify("Rutina aplicada. Buscala en el Constructor para ajustar lo que haga falta.");
          }}
        />
      )}
    </div>
  );
}

function LooseTemplateCard({
  template,
  onDelete,
  onApplyDay,
}: {
  template: WorkoutTemplateRow;
  onDelete: () => void;
  onApplyDay: (day: WorkoutTemplateSessionRow) => void;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<WorkoutTemplateSessionRow[] | null>(null);

  const toggle = async () => {
    if (!open && days === null) {
      try {
        setDays(await listTemplateSessions(template.id));
      } catch (e: any) {
        notify(e.message);
        return;
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div className="panel">
      <div className="bd">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <b>{template.name}</b>
            <div className="note">
              {days ? `${days.length} día${days.length === 1 ? "" : "s"}` : "…"}
              {template.visibility === "organization" ? " · Compartida con tu equipo" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={toggle}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? "Ocultar días" : "Ver días"}
            </button>
            <button className="btn ghost" onClick={onDelete}><Trash2 size={14} /></button>
          </div>
        </div>

        {open && days && (
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {days.length === 0 && <p className="note">Esta plantilla todavía no tiene ningún día guardado.</p>}
            {days.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <span>
                  <b>Día {d.day_index} — {d.name}</b>
                  {d.focus && <span className="note"> · {d.focus}</span>}
                </span>
                <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => onApplyDay(d)}>
                  Usar con un cliente
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplyTemplateDayModal({
  day,
  clients,
  onClose,
  onApplied,
}: {
  day: WorkoutTemplateSessionRow;
  clients: ClientRow[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const { notify } = useToast();
  const [clientId, setClientId] = useState("");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weekId, setWeekId] = useState("");
  const [sessionName, setSessionName] = useState(day.name);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const pickClient = async (id: string) => {
    setClientId(id);
    setWeeks([]);
    setWeekId("");
    if (!id) return;
    setLoadingWeeks(true);
    try {
      const program = await getActiveProgramForClient(id);
      if (!program) {
        setError("Este cliente todavía no tiene un programa activo — creá uno primero en Planificación.");
      } else {
        setError("");
        const ws = await listWeeks(program.id);
        setWeeks(ws);
        setWeekId(ws[0]?.id ?? "");
      }
    } catch (e: any) {
      notify(e.message);
    }
    setLoadingWeeks(false);
  };

  const submit = async () => {
    if (!weekId) {
      setError("Elegí una semana.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const existing = await listSessions(weekId);
      await applyTemplateDayToWeek({
        templateSessionId: day.id,
        templateSessionName: sessionName.trim() || day.name,
        targetWeekId: weekId,
        sortOrder: existing.length,
      });
      onApplied();
    } catch (e: any) {
      setError(e.message ?? "No pudimos aplicar esta rutina.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Usar "${day.name}"`} onClose={onClose}>
      <label className="field-label">Cliente</label>
      <SearchSelect className="input" style={{ marginBottom: 14 }} value={clientId} onChange={(e) => pickClient(e.target.value)}>
        <option value="">Elegí un cliente</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </SearchSelect>

      {loadingWeeks && <Loading />}

      {weeks.length > 0 && (
        <>
          <label className="field-label">Semana</label>
          <select className="input" style={{ marginBottom: 14 }} value={weekId} onChange={(e) => setWeekId(e.target.value)}>
            {weeks.map((w) => <option key={w.id} value={w.id}>Semana {w.week_number}</option>)}
          </select>
          <label className="field-label">Nombre de la rutina para este cliente</label>
          <input className="input" style={{ marginBottom: 18 }} value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
        </>
      )}

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving || !weekId}>{saving ? "Aplicando…" : "Aplicar a esta semana"}</button>
    </Modal>
  );
}

function ApplyTemplateModal({
  template,
  clients,
  organizationId,
  trainerId,
  onClose,
  onApplied,
}: {
  template: ProgramRow;
  clients: ClientRow[];
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onApplied: (programId: string) => void;
}) {
  const { notify } = useToast();
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState(template.name);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!clientId) {
      notify("Elegí un cliente.");
      return;
    }
    setSaving(true);
    try {
      const created = await cloneProgram({
        sourceProgram: template,
        organizationId,
        trainerId,
        name: name.trim() || template.name,
        targetClientId: clientId,
      });
      onApplied(created.id);
    } catch (e: any) {
      notify(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Usar "${template.name}"`} onClose={onClose}>
      <label className="field-label">Cliente</label>
      <SearchSelect className="input" style={{ marginBottom: 14 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
        <option value="">Elegí un cliente</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </SearchSelect>
      <label className="field-label">Nombre del programa para este cliente</label>
      <input className="input" style={{ marginBottom: 18 }} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Aplicando…" : "Aplicar plantilla"}</button>
    </Modal>
  );
}
