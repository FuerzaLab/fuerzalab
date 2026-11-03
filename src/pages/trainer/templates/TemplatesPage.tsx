import { useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Loading from "../../../components/ui/Loading";
import { listClients, type ClientRow } from "../../../services/clients";
import { listTemplates, deleteProgram, listWeeks, METHOD_LABEL, type ProgramRow, type WeekRow } from "../../../services/programs";
import { cloneProgram, listSessions, listWorkoutExercises } from "../../../services/sessions";
import { getActiveProgramForClient } from "../../../services/training";
import {
  listWorkoutTemplates,
  deleteWorkoutTemplate,
  listTemplateSessions,
  applyTemplateDayToWeek,
  type WorkoutTemplateRow,
  type WorkoutTemplateSessionRow,
  listTemplateExercises,
} from "../../../services/templates";
import SearchSelect from "../../../components/ui/SearchSelect";
import EmptyState from "../../../components/ui/EmptyState";
import { formatLoad } from "../../../lib/units";
import { STARTER_TEMPLATES, installStarterTemplates } from "../../../services/starterTemplates";
import Chip from "../../../components/ui/Chip";

export default function TemplatesPage() {
  const { profile, actingTrainerId } = useAuth();
  const { notify } = useToast();
  const [viewing, setViewing] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [looseTemplates, setLooseTemplates] = useState<WorkoutTemplateRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<ProgramRow | null>(null);
  const [deleting, setDeleting] = useState<ProgramRow | null>(null);
  const [deletingLoose, setDeletingLoose] = useState<WorkoutTemplateRow | null>(null);
  const [applyingDay, setApplyingDay] = useState<{ template: WorkoutTemplateRow; day: WorkoutTemplateSessionRow } | null>(null);
  const [installing, setInstalling] = useState(false);
  const starterNames = new Set(STARTER_TEMPLATES.map((t) => t.name));
  const missingStarters = STARTER_TEMPLATES.filter((t) => !looseTemplates.some((x) => x.name === t.name)).length;

  /** Agrega las 4 rutinas de ejemplo (crea los ejercicios que no estén en la biblioteca). */
  const installStarters = async () => {
    if (!profile?.organization_id) return;
    setInstalling(true);
    try {
      const r = await installStarterTemplates(profile.organization_id, actingTrainerId ?? profile.id);
      notify(
        r.templates
          ? `Listo: ${r.templates} ${r.templates === 1 ? "rutina de ejemplo" : "rutinas de ejemplo"}${r.exercises ? ` y ${r.exercises} ejercicios nuevos en tu biblioteca` : ""}. Ábrelas, ajústalas y úsalas con tus alumnos.`
          : "Ya tienes todas las rutinas de ejemplo.",
      );
      await load();
    } catch (e: any) {
      notify("No se pudieron agregar las rutinas de ejemplo: " + e.message);
    }
    setInstalling(false);
  };

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
        Programas guardados sin un cliente asignado, con todas sus semanas y bloques. Para crear uno, ve a Planificación con un cliente, arma el programa como quieras, y toca "Guardar como plantilla".
      </p>

      {loading ? (
        <Loading />
      ) : templates.length === 0 ? (
        <EmptyState title="Todavía no guardaste ninguna plantilla">
          Cuando un programa te funcione bien, guárdalo con "Guardar como plantilla" en Planificación. Después lo aplicas a
          cualquier alumno y lo ajustas, sin empezar de cero.
        </EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {templates.map((t) => (
            <div key={t.id} className="panel">
              <div className="bd">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <b>{t.name}</b>
                    <div className="note">{METHOD_LABEL[t.method]}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn ghost" onClick={() => setViewing((v) => (v === t.id ? null : t.id))}>
                      {viewing === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {viewing === t.id ? "Ocultar" : "Ver ejercicios"}
                    </button>
                    <button className="btn" onClick={() => setApplyingTo(t)}>Usar con un cliente</button>
                    <button className="btn ghost" onClick={() => setDeleting(t)}><Trash2 size={14} /></button>
                  </div>
                </div>
                {viewing === t.id && <ProgramTemplateContent programId={t.id} />}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 4, marginTop: 28 }}>Rutinas sueltas</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        Días de entrenamiento guardados por separado — útil para un split que usas con varios clientes, sin tener que armarlo entero cada vez. Para crear uno, ve al Constructor de rutinas y toca "Guardar como plantilla" sobre la rutina que tengas abierta.
      </p>

      {!loading && missingStarters > 0 && looseTemplates.length > 0 && (
        <div className="import-create-all" style={{ marginBottom: 12 }}>
          <span style={{ flex: "1 1 240px" }}>¿Quieres rutinas de ejemplo para empezar más rápido? Hay {missingStarters} que todavía no agregaste.</span>
          <button className="btn" style={{ padding: "6px 12px", fontSize: 13 }} onClick={installStarters} disabled={installing}>
            {installing ? "Agregando…" : "Agregar rutinas de ejemplo"}
          </button>
        </div>
      )}
      {loading ? null : looseTemplates.length === 0 ? (
        <EmptyState
          title="Empieza con rutinas de ejemplo"
          action={{ label: installing ? "Agregando…" : "Agregar 4 rutinas de ejemplo", onClick: () => !installing && installStarters() }}
        >
          Fuerza para principiantes (3 días), hipertrofia torso/pierna (4 días), tren inferior (2 días) y full body para poco
          tiempo (2 días). Las aplicas a un alumno y las ajustas. También puedes guardar las tuyas con "Guardar como plantilla"
          en el Constructor de rutinas.
        </EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {looseTemplates.map((t) => (
            <LooseTemplateCard key={t.id} template={t} isStarter={starterNames.has(t.name)} onDelete={() => setDeletingLoose(t)} onApplyDay={(day) => setApplyingDay({ template: t, day })} />
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
            notify("Plantilla aplicada. Elige a ese cliente en Planificación para ajustar lo que haga falta.");
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
            notify("Rutina aplicada. Búscala en el Constructor para ajustar lo que haga falta.");
          }}
        />
      )}
    </div>
  );
}

function LooseTemplateCard({
  template,
  isStarter,
  onDelete,
  onApplyDay,
}: {
  template: WorkoutTemplateRow;
  isStarter?: boolean;
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
            <b>{template.name}</b> {isStarter && <Chip tone="pri">Ejemplo</Chip>}
            {template.description && <div className="note" style={{ fontSize: 13 }}>{template.description}</div>}
            <div className="note">
              {days ? `${days.length} día${days.length === 1 ? "" : "s"}` : ""}
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
              <LooseDayRow key={d.id} day={d} onApply={() => onApplyDay(d)} />
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
        setError("Este cliente todavía no tiene un programa activo — crea uno primero en Planificación.");
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
      setError("Elige una semana.");
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
        <option value="">Elige un cliente</option>
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
      notify("Elige un cliente.");
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
        <option value="">Elige un cliente</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </SearchSelect>
      <label className="field-label">Nombre del programa para este cliente</label>
      <input className="input" style={{ marginBottom: 18 }} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Aplicando…" : "Aplicar plantilla"}</button>
    </Modal>
  );
}

// --- Ver ejercicios de una plantilla --------------------------------------

interface ExLine {
  id: string;
  exercise_name: string;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  load_value: number | null;
  rir: number | null;
  rest_s: number | null;
  superset_group: number | null;
}

const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`);

/** Lista de ejercicios de un día: "A1 Sentadilla — 4 × 6–8 · 130 kg · RIR 2 · descanso 2:30". */
function ExerciseLines({ items }: { items: ExLine[] }) {
  if (items.length === 0) return <p className="note" style={{ margin: "4px 0 0" }}>Este día no tiene ejercicios.</p>;
  // Letra por grupo (biserie / serie gigante): A, B, C… en el orden en que aparecen.
  const letters = new Map<number, string>();
  const pos = new Map<number, number>();
  for (const it of items) if (it.superset_group != null && !letters.has(it.superset_group)) letters.set(it.superset_group, String.fromCharCode(65 + letters.size));
  return (
    <ol className="tpl-ex">
      {items.map((it) => {
        let tag = "";
        if (it.superset_group != null && items.filter((x) => x.superset_group === it.superset_group).length > 1) {
          const n = (pos.get(it.superset_group) ?? 0) + 1;
          pos.set(it.superset_group, n);
          tag = `${letters.get(it.superset_group)}${n}`;
        }
        const reps = it.reps_min != null && it.reps_max != null && it.reps_min !== it.reps_max ? `${it.reps_min}–${it.reps_max}` : it.reps_max ?? it.reps_min ?? "—";
        const parts = [`${it.sets ?? "—"} × ${reps}`];
        if (it.load_value) parts.push(formatLoad(it.load_value, "kg"));
        if (it.rir != null) parts.push(`RIR ${it.rir}`);
        if (it.rest_s) parts.push(`descanso ${fmtRest(it.rest_s)}`);
        return (
          <li key={it.id}>
            {tag && <span className="chip pri" style={{ marginRight: 6 }}>{tag}</span>}
            <b>{it.exercise_name}</b>
            <span className="note"> — {parts.join(" · ")}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Un día de una rutina suelta, con su botón "Ver ejercicios". */
function LooseDayRow({ day, onApply }: { day: WorkoutTemplateSessionRow; onApply: () => void }) {
  const { notify } = useToast();
  const [items, setItems] = useState<ExLine[] | null>(null);
  const [open, setOpen] = useState(false);
  const toggle = async () => {
    if (!open && items === null) {
      try {
        setItems(await listTemplateExercises(day.id));
      } catch (e: any) {
        notify(e.message);
        return;
      }
    }
    setOpen((o) => !o);
  };
  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>
          <b>Día {day.day_index} — {day.name}</b>
          {day.focus && <span className="note"> · {day.focus}</span>}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={toggle}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open ? "Ocultar ejercicios" : "Ver ejercicios"}
          </button>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={onApply}>
            Usar con un cliente
          </button>
        </span>
      </div>
      {open && items && <ExerciseLines items={items} />}
    </div>
  );
}

/** Contenido de un programa completo: elige la semana y ve sus días con sus ejercicios. */
function ProgramTemplateContent({ programId }: { programId: string }) {
  const { notify } = useToast();
  const [weeks, setWeeks] = useState<WeekRow[] | null>(null);
  const [weekId, setWeekId] = useState("");
  const [days, setDays] = useState<{ id: string; name: string; items: ExLine[] }[] | null>(null);

  useEffect(() => {
    listWeeks(programId)
      .then((w) => {
        setWeeks(w);
        if (w[0]) setWeekId(w[0].id);
      })
      .catch((e: any) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  useEffect(() => {
    if (!weekId) return;
    setDays(null);
    (async () => {
      const sessions = await listSessions(weekId);
      const withEx = await Promise.all(
        sessions.map(async (se) => ({ id: se.id, name: se.name, items: (await listWorkoutExercises(se.id)) as unknown as ExLine[] })),
      );
      setDays(withEx);
    })().catch((e: any) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  if (!weeks) return <Loading />;
  if (weeks.length === 0) return <p className="note">Este programa no tiene semanas.</p>;
  return (
    <div style={{ marginTop: 12 }}>
      {weeks.length > 1 && (
        <select className="input" style={{ width: "auto", marginBottom: 8 }} value={weekId} onChange={(e) => setWeekId(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>Semana {w.week_number}</option>
          ))}
        </select>
      )}
      {!days ? (
        <Loading />
      ) : days.length === 0 ? (
        <p className="note">Esta semana no tiene días armados.</p>
      ) : (
        days.map((d) => (
          <div key={d.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
            <b>{d.name}</b>
            <ExerciseLines items={d.items} />
          </div>
        ))
      )}
    </div>
  );
}
