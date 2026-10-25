import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import Loading from "../../../components/ui/Loading";
import { listClients, type ClientRow } from "../../../services/clients";
import {
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  deactivateRecurrence,
  APPOINTMENT_KIND_LABEL,
  type AppointmentRow,
  type AppointmentKind,
} from "../../../services/appointments";
import { createClientWithInvite } from "../../../services/clients";

const DAY_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}
function fmtDayHeader(d: Date): string {
  return `${DAY_LABEL[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function AgendaPage() {
  const { profile, actingTrainerId } = useAuth();
  const { notify } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridSpan, setGridSpan] = useState<"week" | "biweek">("week");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ appt: AppointmentRow | null; defaultDate: Date } | null>(null);
  const [deleting, setDeleting] = useState<AppointmentRow | null>(null);
  const [deactivating, setDeactivating] = useState<AppointmentRow | null>(null);

  const spanDays = viewMode === "grid" && gridSpan === "biweek" ? 14 : 7;
  const days = Array.from({ length: spanDays }, (_, i) => addDays(weekStart, i));

  const load = async () => {
    setLoading(true);
    try {
      const rangeStart = weekStart.toISOString();
      const rangeEnd = addDays(weekStart, spanDays).toISOString();
      const [appts, cs] = await Promise.all([listAppointments(rangeStart, rangeEnd), listClients()]);
      setAppointments(appts);
      setClients(cs);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, viewMode, gridSpan]);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.full_name ?? "Cliente eliminado";

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Agenda</h1>
        <button className="btn" onClick={() => setEditing({ appt: null, defaultDate: new Date() })}>
          <Plus size={16} /> Nueva cita
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={() => setWeekStart((w) => addDays(w, -spanDays))}><ChevronLeft size={16} /></button>
        <button className="btn ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</button>
        <button className="btn ghost" onClick={() => setWeekStart((w) => addDays(w, spanDays))}><ChevronRight size={16} /></button>
        <span className="note">
          {days[0].getDate()}/{days[0].getMonth() + 1} — {days[days.length - 1].getDate()}/{days[days.length - 1].getMonth() + 1}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`btn ${viewMode === "list" ? "" : "ghost"}`} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setViewMode("list")}>Lista</button>
        <button
          className={`btn ${viewMode === "grid" && gridSpan === "week" ? "" : "ghost"}`}
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={() => { setViewMode("grid"); setGridSpan("week"); }}
        >
          Grilla semanal
        </button>
        <button
          className={`btn ${viewMode === "grid" && gridSpan === "biweek" ? "" : "ghost"}`}
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={() => { setViewMode("grid"); setGridSpan("biweek"); }}
        >
          Grilla quincenal
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : viewMode === "grid" ? (
        <WeekGrid
          days={days}
          appointments={appointments}
          clientName={clientName}
          onCellClick={(day, hour) => {
            const d = new Date(day);
            d.setHours(hour, 0, 0, 0);
            setEditing({ appt: null, defaultDate: d });
          }}
          onApptClick={(a, day) => setEditing({ appt: a, defaultDate: day })}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {days.map((day) => {
            const dayKey = toDateKey(day);
            const dayAppts = appointments.filter((a) => a.starts_at.slice(0, 10) === dayKey);
            const isToday = toDateKey(day) === toDateKey(new Date());
            return (
              <div key={dayKey} className="panel">
                <div className="hd">
                  <h3 style={{ color: isToday ? "var(--pri)" : undefined }}>{fmtDayHeader(day)}{isToday ? " · Hoy" : ""}</h3>
                  <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditing({ appt: null, defaultDate: day })}>
                    <Plus size={12} /> Agregar
                  </button>
                </div>
                <div className="bd">
                  {dayAppts.length === 0 && <p className="note">Sin citas.</p>}
                  {dayAppts.map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                      <span>
                        <b>{fmtTime(a.starts_at)}–{fmtTime(a.ends_at)}</b>{" "}
                        <Chip tone={a.kind === "online" ? "pri" : "ok"}>{APPOINTMENT_KIND_LABEL[a.kind]}</Chip>{" "}
                        {a.recurrence_id && <Chip tone="warn">Repite</Chip>}{" "}
                        {a.title || clientName(a.client_id)}
                        {a.title && <span className="note"> — {clientName(a.client_id)}</span>}
                        {a.notes && <div className="note">{a.notes}</div>}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        {a.recurrence_id && (
                          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setDeactivating(a)}>
                            Desactivar repetición
                          </button>
                        )}
                        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditing({ appt: a, defaultDate: day })}>
                          Editar
                        </button>
                        <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={() => setDeleting(a)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AppointmentModal
          appt={editing.appt}
          defaultDate={editing.defaultDate}
          clients={clients}
          organizationId={profile.organization_id!}
          trainerId={(actingTrainerId ?? profile.id)}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
          onDeleted={async () => {
            setEditing(null);
            await load();
            notify("Cita eliminada.");
          }}
          onClientCreated={(c) => setClients((cs) => [...cs, c])}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar cita"
          message={`¿Eliminar la cita del ${fmtTime(deleting.starts_at)}? Esto borra solo esta cita puntual, no afecta a las demás de la serie repetida.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteAppointment(deleting.id);
            setAppointments((as) => as.filter((a) => a.id !== deleting.id));
            setDeleting(null);
            notify("Cita eliminada.");
          }}
        />
      )}

      {deactivating && (
        <ConfirmModal
          title="Desactivar repetición"
          message="Esto borra todas las citas futuras de esta serie repetida, a partir de ahora. Las que ya pasaron quedan en tu historial, sin tocarse."
          confirmLabel="Desactivar"
          danger
          onClose={() => setDeactivating(null)}
          onConfirm={async () => {
            const removed = await deactivateRecurrence(deactivating.recurrence_id!);
            setDeactivating(null);
            await load();
            notify(`Se desactivó la repetición — se quitaron ${removed} cita${removed === 1 ? "" : "s"} futura${removed === 1 ? "" : "s"}.`);
          }}
        />
      )}
    </div>
  );
}

type DayCell = { type: "start"; appt: AppointmentRow; span: number } | { type: "skip" } | { type: "empty" };

/** Para una columna (un día), decide qué le toca a cada fila de hora: el inicio de un bloque (con cuántas filas ocupa), una fila cubierta por un bloque que empezó antes (no se dibuja), o una celda vacía. */
function buildDayMap(day: Date, appointments: AppointmentRow[], hourList: number[]): Record<number, DayCell> {
  const dayKey = toDateKey(day);
  const dayAppts = appointments
    .filter((a) => a.starts_at.slice(0, 10) === dayKey)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const map: Record<number, DayCell> = {};
  const consumed = new Set<number>();
  const firstHour = hourList[0];
  const lastHour = hourList[hourList.length - 1];

  for (const a of dayAppts) {
    const startDate = new Date(a.starts_at);
    const endDate = new Date(a.ends_at);
    const sh = Math.max(startDate.getHours(), firstHour);
    const ehRaw = endDate.getHours() + (endDate.getMinutes() > 0 ? 1 : 0);
    const eh = Math.min(Math.max(ehRaw, sh + 1), lastHour + 1);
    if (consumed.has(sh) || map[sh]) continue; // ya hay algo ahí (cita superpuesta) — se deja la primera, para no romper la grilla
    const span = eh - sh;
    map[sh] = { type: "start", appt: a, span };
    for (let h = sh + 1; h < sh + span; h++) consumed.add(h);
  }

  for (const h of hourList) {
    if (map[h]) continue;
    map[h] = consumed.has(h) ? { type: "skip" } : { type: "empty" };
  }
  return map;
}

/**
 * Grilla de horas × días — pensada para ver la ocupación de un pantallazo.
 * Cada cita ocupa, con rowSpan, todas las filas de hora que dura — una de
 * 6 a 9 se ve como un solo bloque alto, no solo marcada en la fila de las 6.
 */
function WeekGrid({
  days,
  appointments,
  clientName,
  onCellClick,
  onApptClick,
}: {
  days: Date[];
  appointments: AppointmentRow[];
  clientName: (id: string | null) => string;
  onCellClick: (day: Date, hour: number) => void;
  onApptClick: (a: AppointmentRow, day: Date) => void;
}) {
  let minHour = 7;
  let maxHour = 20;
  for (const a of appointments) {
    const sh = new Date(a.starts_at).getHours();
    const eh = new Date(a.ends_at).getHours() + (new Date(a.ends_at).getMinutes() > 0 ? 1 : 0);
    if (sh < minHour) minHour = sh;
    if (eh > maxHour) maxHour = eh;
  }
  const hourList = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  const dayMaps = days.map((day) => buildDayMap(day, appointments, hourList));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: days.length * 110 }}>
        <thead>
          <tr>
            <th style={{ width: 54 }} />
            {days.map((d) => {
              const isToday = toDateKey(d) === toDateKey(new Date());
              return (
                <th
                  key={toDateKey(d)}
                  style={{ padding: "6px 4px", fontSize: 12, fontWeight: 600, color: isToday ? "var(--pri)" : undefined, borderBottom: "1px solid var(--line)" }}
                >
                  {DAY_LABEL[d.getDay()].slice(0, 3)} {d.getDate()}/{d.getMonth() + 1}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {hourList.map((hour) => (
            <tr key={hour}>
              <td style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", paddingRight: 6, borderTop: "1px solid var(--line)", verticalAlign: "top", whiteSpace: "nowrap" }}>
                {String(hour).padStart(2, "0")}:00
              </td>
              {days.map((day, dayIdx) => {
                const cell = dayMaps[dayIdx][hour];
                if (cell.type === "skip") return null;
                if (cell.type === "start") {
                  const a = cell.appt;
                  return (
                    <td
                      key={toDateKey(day)}
                      rowSpan={cell.span}
                      style={{ borderTop: "1px solid var(--line)", borderLeft: "1px solid var(--line)", padding: 2, verticalAlign: "top" }}
                    >
                      <div
                        onClick={() => onApptClick(a, day)}
                        style={{
                          background: a.kind === "online" ? "#E5EAF8" : "#E1F1EA",
                          color: a.kind === "online" ? "var(--pri)" : "#1F6B52",
                          borderRadius: 5,
                          padding: "4px 6px",
                          fontSize: 11,
                          cursor: "pointer",
                          lineHeight: 1.35,
                          height: "100%",
                          minHeight: 30 * cell.span - 4,
                        }}
                      >
                        <b>{fmtTime(a.starts_at)}–{fmtTime(a.ends_at)}</b><br />
                        {a.title || clientName(a.client_id)}
                      </div>
                    </td>
                  );
                }
                return (
                  <td
                    key={toDateKey(day)}
                    style={{ borderTop: "1px solid var(--line)", borderLeft: "1px solid var(--line)", minHeight: 30, padding: 2, verticalAlign: "top", cursor: "pointer" }}
                    onClick={() => onCellClick(day, hour)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentModal({
  appt,
  defaultDate,
  clients,
  organizationId,
  trainerId,
  onClose,
  onSaved,
  onDeleted,
  onClientCreated,
}: {
  appt: AppointmentRow | null;
  defaultDate: Date;
  clients: ClientRow[];
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onClientCreated: (c: ClientRow) => void;
}) {
  const { notify } = useToast();
  const [localClients, setLocalClients] = useState(clients);
  const [clientId, setClientId] = useState(appt?.client_id ?? "");
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>(appt?.kind ?? "in_person");
  const [title, setTitle] = useState(appt?.title ?? "");
  const [date, setDate] = useState(appt ? appt.starts_at.slice(0, 10) : toDateKey(defaultDate));
  const defaultHour = defaultDate.getHours();
  const [startTime, setStartTime] = useState(appt ? fmtTime(appt.starts_at) : defaultHour ? `${String(defaultHour).padStart(2, "0")}:00` : "09:00");
  const [endTime, setEndTime] = useState(appt ? fmtTime(appt.ends_at) : defaultHour ? `${String(defaultHour + 1).padStart(2, "0")}:00` : "10:00");
  const [notes, setNotes] = useState(appt?.notes ?? "");
  const [repeat, setRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState("8");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!clientId) {
      setError("Elegí un cliente.");
      return;
    }
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);
    if (endsAt <= startsAt) {
      setError("La hora de fin tiene que ser después de la de inicio.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (appt) {
        await updateAppointment(appt.id, { clientId, kind, title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), notes });
      } else {
        await createAppointment({
          organizationId,
          trainerId,
          clientId,
          kind,
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          notes,
          repeatWeeks: repeat ? Math.max(2, Number(repeatWeeks) || 2) : undefined,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar la cita.");
      setSaving(false);
    }
  };

  return (
    <Modal title={appt ? "Editar cita" : "Nueva cita"} onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="field-label">Cliente</label>
        {!addingClient && (
          <button type="button" className="btn ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setAddingClient(true)}>
            + Nuevo cliente
          </button>
        )}
      </div>
      {addingClient ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <label className="field-label">Nombre</label>
          <input className="input" style={{ marginBottom: 8 }} value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
          <label className="field-label">Correo</label>
          <input className="input" style={{ marginBottom: 10 }} value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{ padding: "5px 12px", fontSize: 12.5 }}
              disabled={creatingClient || !newClientName.trim() || !newClientEmail.trim()}
              onClick={async () => {
                setCreatingClient(true);
                try {
                  const { client } = await createClientWithInvite({
                    organizationId,
                    trainerId,
                    fullName: newClientName.trim(),
                    email: newClientEmail.trim(),
                  });
                  setLocalClients((cs) => [...cs, client]);
                  setClientId(client.id);
                  onClientCreated(client);
                  setAddingClient(false);
                  setNewClientName("");
                  setNewClientEmail("");
                  notify(`"${client.full_name}" agregado — no te olvides de invitarlo desde Clientes.`);
                } catch (e: any) {
                  notify(e.message);
                }
                setCreatingClient(false);
              }}
            >
              {creatingClient ? "Creando…" : "Crear y usar"}
            </button>
            <button type="button" className="btn ghost" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => setAddingClient(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <select className="input" style={{ marginBottom: 14 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Elegí un cliente</option>
          {localClients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      )}

      <label className="field-label">Tipo</label>
      <select className="input" style={{ marginBottom: 14 }} value={kind} onChange={(e) => setKind(e.target.value as AppointmentKind)}>
        <option value="in_person">Presencial</option>
        <option value="online">Online</option>
      </select>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label className="field-label">Fecha</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Desde</label>
          <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Hasta</label>
          <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      {!appt && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            <span>Repetir todas las semanas en este mismo día y horario</span>
          </label>
          {repeat && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="note">Durante</span>
              <input className="input" style={{ width: 70 }} inputMode="numeric" value={repeatWeeks} onChange={(e) => setRepeatWeeks(e.target.value.replace(/\D/g, ""))} />
              <span className="note">semanas</span>
            </div>
          )}
        </div>
      )}

      <label className="field-label">Título (opcional)</label>
      <input className="input" style={{ marginBottom: 14 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sesión de piernas" />

      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 18 }} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        {appt && !confirmingDelete && (
          <button type="button" className="btn ghost" style={{ color: "var(--bad)" }} onClick={() => setConfirmingDelete(true)}>
            Eliminar cita
          </button>
        )}
        {appt && confirmingDelete && (
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="note">¿Seguro?</span>
            <button
              type="button"
              className="btn"
              style={{ background: "var(--bad)", borderColor: "var(--bad)", padding: "5px 12px", fontSize: 12.5 }}
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteAppointment(appt.id);
                  onDeleted();
                } catch (e: any) {
                  notify(e.message);
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button type="button" className="btn ghost" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => setConfirmingDelete(false)}>
              No
            </button>
          </span>
        )}
      </div>
    </Modal>
  );
}
