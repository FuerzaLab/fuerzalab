import { useEffect, useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import Loading from "../../../components/ui/Loading";
import { paths } from "../../../routes/paths";
import type { StaffPermissions, StaffLevel, StaffClientScope } from "../../../types/auth";
import { listClients, type ClientRow } from "../../../services/clients";
import { MODULE_ROWS, LEVEL_LABEL, PRESETS, levelOf, setLevel, summarizePermissions } from "../../../lib/staffModules";
import {
  listMyStaff,
  listStaffInvitations,
  inviteStaff,
  revokeStaffInvitation,
  updateStaffPermissions,
  setStaffActive,
  countAssignmentsByStaff,
  listAssignedClientIds,
  saveClientAccess,
  type StaffMemberRow,
  type StaffInvitationRow,
} from "../../../services/staff";

const inviteLink = (code: string) => `${window.location.origin}${paths.register}?codigo=${code}`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function scopeText(scope: StaffClientScope, count: number): string {
  if (scope === "all") return "todos tus clientes (incluidos los nuevos que sumes)";
  if (count === 0) return "solo los asignados — todavía ninguno";
  return `solo los asignados (${count})`;
}

export default function TeamPage() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [members, setMembers] = useState<StaffMemberRow[]>([]);
  const [invites, setInvites] = useState<StaffInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<StaffMemberRow | null>(null);
  const [toToggle, setToToggle] = useState<StaffMemberRow | null>(null);
  const [toRevoke, setToRevoke] = useState<StaffInvitationRow | null>(null);
  const [assignedCount, setAssignedCount] = useState<Record<string, number>>({});
  const [clientAccessFor, setClientAccessFor] = useState<StaffMemberRow | null>(null);

  const load = async () => {
    if (!profile) return;
    try {
      const [m, i] = await Promise.all([listMyStaff(profile.id), listStaffInvitations()]);
      setMembers(m);
      setInvites(i);
      // Si todavía no se corrió part3p_migration.sql la tabla no existe:
      // se sigue mostrando todo lo demás, solo sin los conteos.
      setAssignedCount(await countAssignmentsByStaff(profile.id).catch((): Record<string, number> => ({})));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Equipo</h1>
        <button className="btn" onClick={() => setShowInvite(true)}>
          <UserPlus size={16} /> Invitar asistente
        </button>
      </div>
      <p className="note" style={{ marginBottom: 20, maxWidth: 720 }}>
        Suma asistentes que trabajen con tus clientes en tu nombre. Tú decides qué secciones ve cada uno y si solo puede
        mirar o también editar. Nunca ven tus pagos ni la salud de tus clientes a menos que se lo habilites.
      </p>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="hd"><h3>Asistentes</h3></div>
            <div className="bd">
              {members.length === 0 ? (
                <p className="note" style={{ margin: 0 }}>Todavía no tienes asistentes. Invita al primero con el botón de arriba.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {members.map((m) => (
                    <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <strong>{m.full_name}</strong>{" "}
                          {m.is_active ? <Chip tone="ok">Activo</Chip> : <Chip tone="bad">Desactivado</Chip>}
                          <div className="note" style={{ fontSize: 13 }}>
                            {m.email}
                            {" · "}
                            {m.last_sign_in_at ? `Último ingreso: ${fmtDate(m.last_sign_in_at)}` : "Todavía no entró a la app"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setEditing(m)}>
                            Editar permisos
                          </button>
                          <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setClientAccessFor(m)}>
                            Clientes
                          </button>
                          <button
                            className="btn ghost"
                            style={{ padding: "6px 12px", fontSize: 13, color: m.is_active ? "var(--bad)" : undefined }}
                            onClick={() => setToToggle(m)}
                          >
                            {m.is_active ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </div>
                      <p className="note" style={{ margin: "8px 0 0", fontSize: 13 }}>{summarizePermissions(m.permissions)}</p>
                      <p className="note" style={{ margin: "4px 0 0", fontSize: 13 }}>
                        <strong>Clientes:</strong> {scopeText(m.client_scope, assignedCount[m.staff_id] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {invites.length > 0 && (
            <div className="panel">
              <div className="hd"><h3>Invitaciones sin aceptar</h3></div>
              <div className="bd" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {invites.map((inv) => {
                  const expired = inv.status === "expired" || new Date(inv.expires_at) < new Date();
                  return (
                    <div key={inv.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <strong>{inv.full_name || inv.email || "Sin nombre"}</strong>{" "}
                          {expired ? <Chip tone="bad">Vencida</Chip> : <Chip tone="warn">Pendiente</Chip>}
                          <div className="note" style={{ fontSize: 13 }}>
                            Código <strong style={{ letterSpacing: 1 }}>{inv.code}</strong>
                            {" · "}
                            {expired ? `Venció el ${fmtDate(inv.expires_at)}` : `Vence el ${fmtDate(inv.expires_at)}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {!expired && (
                            <button
                              className="btn ghost"
                              style={{ padding: "6px 12px", fontSize: 13 }}
                              onClick={() => {
                                navigator.clipboard?.writeText(inviteLink(inv.code));
                                notify("Enlace copiado");
                              }}
                            >
                              <Copy size={14} /> Copiar enlace
                            </button>
                          )}
                          <button
                            className="btn ghost"
                            style={{ padding: "6px 12px", fontSize: 13, color: "var(--bad)" }}
                            onClick={() => setToRevoke(inv)}
                          >
                            {expired ? "Quitar" : "Revocar"}
                          </button>
                        </div>
                      </div>
                      <p className="note" style={{ margin: "8px 0 0", fontSize: 13 }}>{summarizePermissions(inv.permissions)}</p>
                      <p className="note" style={{ margin: "4px 0 0", fontSize: 13 }}>
                        <strong>Clientes:</strong>{" "}
                        {inv.permissions._client_scope === "assigned"
                          ? "solo los que le asignes (después de que acepte, desde el botón Clientes)"
                          : "todos tus clientes"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InviteStaffModal
          organizationId={profile.organization_id!}
          trainerId={profile.id}
          onClose={() => setShowInvite(false)}
          onCreated={load}
        />
      )}

      {editing && (
        <EditPermissionsModal
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(permissions) => {
            setMembers((ms) => ms.map((x) => (x.id === editing.id ? { ...x, permissions } : x)));
            setEditing(null);
          }}
        />
      )}

      {clientAccessFor && (
        <ClientAccessModal
          member={clientAccessFor}
          onClose={() => setClientAccessFor(null)}
          onSaved={(scope, count) => {
            const m = clientAccessFor;
            setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, client_scope: scope } : x)));
            setAssignedCount((c) => ({ ...c, [m.staff_id]: count }));
            setClientAccessFor(null);
          }}
        />
      )}

      {toToggle && (
        <ConfirmModal
          title={toToggle.is_active ? "Desactivar asistente" : "Reactivar asistente"}
          message={
            toToggle.is_active
              ? `${toToggle.full_name} deja de poder entrar a la app desde ahora. No se borra nada de lo que cargó, y puedes reactivarlo cuando quieras con los mismos permisos.`
              : `${toToggle.full_name} vuelve a poder entrar, con los mismos permisos que tenía.`
          }
          confirmLabel={toToggle.is_active ? "Desactivar" : "Reactivar"}
          danger={toToggle.is_active}
          onClose={() => setToToggle(null)}
          onConfirm={async () => {
            const m = toToggle;
            setToToggle(null);
            try {
              await setStaffActive(m.staff_id, !m.is_active);
              setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, is_active: !m.is_active } : x)));
              notify(m.is_active ? "Asistente desactivado" : "Asistente reactivado");
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}

      {toRevoke && (
        <ConfirmModal
          title="Revocar invitación"
          message="El código deja de funcionar. Si esa persona todavía no se registró, ya no va a poder hacerlo con este código."
          confirmLabel="Revocar"
          danger
          onClose={() => setToRevoke(null)}
          onConfirm={async () => {
            const inv = toRevoke;
            setToRevoke(null);
            try {
              await revokeStaffInvitation(inv.id);
              setInvites((is) => is.filter((x) => x.id !== inv.id));
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
    </div>
  );
}

function PermissionEditor({ value, onChange }: { value: StaffPermissions; onChange: (p: StaffPermissions) => void }) {
  return (
    <>
      <label className="field-label">Empezar desde</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => onChange({ ...p.permissions })}>
            {p.name}
          </button>
        ))}
      </div>
      <p className="note" style={{ fontSize: 12.5, marginBottom: 14 }}>
        {PRESETS.map((p) => `${p.name}: ${p.description}`).join(" ")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MODULE_ROWS.map((row) => (
          <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{row.label}</div>
              <div className="note" style={{ fontSize: 12.5 }}>{row.hint}</div>
            </div>
            <select
              className="input"
              style={{ width: 160 }}
              value={levelOf(value, row.key)}
              onChange={(e) => onChange(setLevel(value, row, e.target.value as "none" | StaffLevel))}
            >
              {(["none", "read", "write"] as const).map((lv) => (
                <option key={lv} value={lv}>{LEVEL_LABEL[lv]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </>
  );
}

function InviteStaffModal({
  organizationId,
  trainerId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { notify } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<StaffPermissions>({ ...PRESETS[0].permissions });
  const [clientScope, setClientScope] = useState<StaffClientScope>("assigned");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim()) {
      setError("Escribe el nombre del asistente.");
      return;
    }
    if (Object.keys(permissions).length === 0) {
      setError("Habilítale al menos una sección.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const c = await inviteStaff({ organizationId, trainerId, fullName: fullName.trim(), email: email.trim(), permissions, clientScope });
      setCode(c);
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "No pudimos crear la invitación.");
    }
    setLoading(false);
  };

  return (
    <Modal title="Invitar asistente" onClose={onClose} wide={!code}>
      {!code ? (
        <>
          <p className="note" style={{ marginBottom: 14 }}>
            Se genera un código de un solo uso que vence en 14 días. Al registrarse con él, la cuenta queda vinculada a ti
            con los permisos que elijas acá (los puedes cambiar después).
          </p>
          <label className="field-label">Nombre completo</label>
          <input className="input" style={{ marginBottom: 12 }} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          <label className="field-label">Email (opcional, fija el código a ese correo)</label>
          <input className="input" style={{ marginBottom: 18 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label">Qué clientes ve</label>
          <select
            className="input"
            style={{ marginBottom: 4 }}
            value={clientScope}
            onChange={(e) => setClientScope(e.target.value as StaffClientScope)}
          >
            <option value="assigned">Solo los que yo le asigne</option>
            <option value="all">Todos mis clientes</option>
          </select>
          <p className="note" style={{ fontSize: 12.5, marginBottom: 18 }}>
            {clientScope === "assigned"
              ? "Empieza sin ningún cliente. Cuando acepte la invitación, le asignas los que quieras desde el botón \"Clientes\" en esta pantalla. Un cliente nuevo no le aparece hasta que se lo asignes."
              : "Ve a todos tus clientes, también a los que sumes más adelante."}
          </p>
          <PermissionEditor value={permissions} onChange={setPermissions} />
          {error && <p className="error-text" style={{ margin: "14px 0 0" }}>{error}</p>}
          <button className="btn" style={{ marginTop: 16 }} onClick={submit} disabled={loading}>
            {loading ? "Creando…" : "Generar código"}
          </button>
        </>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 12 }}>Comparte este enlace con tu asistente para que cree su cuenta.</p>
          <div
            style={{
              background: "var(--bg)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 26,
              letterSpacing: 2,
              textAlign: "center",
            }}
          >
            {code}
          </div>
          <p className="note" style={{ wordBreak: "break-all", marginBottom: 16 }}>{inviteLink(code)}</p>
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(inviteLink(code));
              notify("Enlace copiado");
              onClose();
            }}
          >
            <Copy size={16} /> Copiar enlace y cerrar
          </button>
        </>
      )}
    </Modal>
  );
}

function EditPermissionsModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMemberRow;
  onClose: () => void;
  onSaved: (p: StaffPermissions) => void;
}) {
  const { notify } = useToast();
  const [permissions, setPermissions] = useState<StaffPermissions>({ ...member.permissions });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateStaffPermissions(member.id, permissions);
      notify("Permisos guardados");
      onSaved(permissions);
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  return (
    <Modal title={`Permisos de ${member.full_name}`} onClose={onClose} wide>
      <PermissionEditor value={permissions} onChange={setPermissions} />
      <p className="note" style={{ fontSize: 12.5, margin: "14px 0" }}>
        La base de datos aplica los cambios al instante. Si tu asistente tiene la app abierta, su menú se actualiza la
        próxima vez que recargue la página.
      </p>
      <button className="btn" onClick={save} disabled={saving}>
        {saving ? "Guardando…" : "Guardar permisos"}
      </button>
    </Modal>
  );
}

function ClientAccessModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMemberRow;
  onClose: () => void;
  onSaved: (scope: StaffClientScope, count: number) => void;
}) {
  const { notify } = useToast();
  const [scope, setScope] = useState<StaffClientScope>(member.client_scope);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listClients(), listAssignedClientIds(member.staff_id)])
      .then(([cs, ids]) => {
        setClients(cs.filter((c) => c.status !== "archived").sort((a, b) => a.full_name.localeCompare(b.full_name)));
        setSelected(new Set(ids));
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.staff_id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visible = clients.filter((c) => c.full_name.toLowerCase().includes(search.trim().toLowerCase()));
  // Solo cuentan los asignados que siguen en la lista (un cliente dado de
  // baja puede quedar asignado de antes; no se borra, pero no se muestra).
  const selectedCount = clients.filter((c) => selected.has(c.id)).length;

  const save = async () => {
    setSaving(true);
    try {
      const keepArchived = Array.from(selected).filter((id) => !clients.some((c) => c.id === id));
      const ids = [...clients.filter((c) => selected.has(c.id)).map((c) => c.id), ...keepArchived];
      await saveClientAccess({ memberId: member.id, staffId: member.staff_id, scope, clientIds: ids });
      notify("Acceso a clientes guardado");
      onSaved(scope, ids.length);
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  return (
    <Modal title={`Clientes de ${member.full_name}`} onClose={onClose}>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
        <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} style={{ marginTop: 3 }} />
        <span>
          <strong>Todos mis clientes</strong>
          <span className="note" style={{ display: "block", fontSize: 12.5 }}>Incluidos los que sumes más adelante.</span>
        </span>
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, cursor: "pointer" }}>
        <input type="radio" checked={scope === "assigned"} onChange={() => setScope("assigned")} style={{ marginTop: 3 }} />
        <span>
          <strong>Solo los que marque acá</strong>
          <span className="note" style={{ display: "block", fontSize: 12.5 }}>
            Un cliente nuevo no le aparece hasta que vuelvas acá y se lo marques.
          </span>
        </span>
      </label>

      {scope === "assigned" &&
        (loading ? (
          <Loading />
        ) : clients.length === 0 ? (
          <p className="note">Todavía no tienes clientes para asignar.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input className="input" placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="note" style={{ whiteSpace: "nowrap", fontSize: 13 }}>{selectedCount} marcados</span>
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, maxHeight: 260, overflowY: "auto", marginBottom: 6 }}>
              {visible.map((c) => (
                <label
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                >
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span style={{ flex: 1 }}>{c.full_name}</span>
                  {c.status === "prospect" && <Chip tone="warn">Sin aceptar</Chip>}
                  {c.status === "paused" && <Chip>Suspendido</Chip>}
                </label>
              ))}
              {visible.length === 0 && <p className="note" style={{ padding: 12, margin: 0 }}>Ningún cliente coincide.</p>}
            </div>
            <p className="note" style={{ fontSize: 12.5, marginBottom: 14 }}>Los clientes dados de baja no aparecen en esta lista.</p>
          </>
        ))}

      <button className="btn" onClick={save} disabled={saving || (scope === "assigned" && loading)}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </Modal>
  );
}
