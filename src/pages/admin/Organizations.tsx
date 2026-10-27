import { useEffect, useState } from "react";
import { Plus, UserPlus, Copy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import Chip from "../../components/ui/Chip";
import {
  listOrganizations,
  listUsers,
  setOrganizationOwner,
  type UserRow,
  createOrganization,
  toggleOrganizationStatus,
  countOrganizationMembers,
  deleteOrganization,
  inviteTrainer,
  type OrganizationRow,
} from "../../services/admin";
import { paths } from "../../routes/paths";
import Loading from "../../components/ui/Loading";

export default function Organizations() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [inviteFor, setInviteFor] = useState<OrganizationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationRow | null>(null);
  const [trainers, setTrainers] = useState<UserRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, u] = await Promise.all([listOrganizations(), listUsers().catch((err: any): UserRow[] => {
        notify(`No se pudo cargar la lista de entrenadores: ${err.message}`);
        return [];
      })]);
      setOrgs(o);
      setTrainers(u.filter((x) => x.role === "trainer"));
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (org: OrganizationRow) => {
    const next = org.status === "active" ? "suspended" : "active";
    try {
      await toggleOrganizationStatus(org.id, next);
      setOrgs((os) => os.map((o) => (o.id === org.id ? { ...o, status: next } : o)));
      notify(next === "active" ? "Organización reactivada" : "Organización suspendida");
    } catch (e: any) {
      notify(e.message);
    }
  };

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Organizaciones</h1>
          <p className="note">Cada organización tiene sus datos aislados. Invita entrenadores desde la fila de cada una.</p>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nueva organización
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "10px 16px" }}>Organización</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
                  <th style={{ padding: "10px 16px" }} title="El dueño ve la pantalla «Tu estudio» con el resumen de todos los entrenadores">Dueño del estudio</th>
                  <th style={{ padding: "10px 16px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "11px 16px" }}><b>{o.name}</b></td>
                    <td style={{ padding: "11px 16px" }}>
                      <Chip tone={o.status === "active" ? "ok" : "bad"}>{o.status === "active" ? "Activa" : "Suspendida"}</Chip>
                    </td>
                    <td style={{ padding: "11px 16px", minWidth: 200 }}>
                      {(() => {
                        const orgTrainers = trainers.filter((t) => t.organization_id === o.id);
                        if (orgTrainers.length < 2) {
                          return <span className="note" style={{ fontSize: 13 }}>{orgTrainers.length === 1 ? "Un solo entrenador" : "Sin entrenadores"}</span>;
                        }
                        return (
                          <select
                            className="input"
                            style={{ padding: "5px 8px", fontSize: 13.5 }}
                            value={o.owner_id ?? ""}
                            onChange={async (e) => {
                              const ownerId = e.target.value || null;
                              try {
                                await setOrganizationOwner(o.id, ownerId);
                                setOrgs((xs) => xs.map((x) => (x.id === o.id ? { ...x, owner_id: ownerId } : x)));
                                notify(ownerId ? "Dueño del estudio guardado." : "El estudio quedó sin dueño.");
                              } catch (err: any) {
                                notify(err.message);
                              }
                            }}
                          >
                            <option value="">Sin dueño</option>
                            {orgTrainers.map((t) => (
                              <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setInviteFor(o)}>
                          <UserPlus size={13} /> Invitar entrenador
                        </button>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => toggleStatus(o)}>
                          {o.status === "active" ? "Suspender" : "Reactivar"}
                        </button>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13, color: "var(--bad)" }} onClick={() => setDeleteTarget(o)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="note" style={{ padding: 16 }}>Todavía no hay organizaciones.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewOrgModal
          onClose={() => setShowNew(false)}
          onCreated={(org) => {
            setOrgs((os) => [org, ...os]);
            setShowNew(false);
            notify(`Organización "${org.name}" creada.`);
          }}
        />
      )}

      {inviteFor && (
        <InviteTrainerModal
          org={inviteFor}
          invitedBy={profile.id}
          onClose={() => setInviteFor(null)}
        />
      )}

      {deleteTarget && (
        <DeleteOrgModal
          org={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setOrgs((os) => os.filter((o) => o.id !== deleteTarget.id));
            setDeleteTarget(null);
            notify(`Organización "${deleteTarget.name}" eliminada.`);
          }}
        />
      )}
    </div>
  );
}

function DeleteOrgModal({ org, onClose, onDeleted }: { org: OrganizationRow; onClose: () => void; onDeleted: () => void }) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    countOrganizationMembers(org.id).then(setMemberCount).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = memberCount !== null && memberCount > 0;

  const submit = async () => {
    if (confirmText.trim() !== org.name) {
      setError("El nombre no coincide. Escríbelo exactamente igual para confirmar.");
      return;
    }
    setError("");
    setDeleting(true);
    try {
      await deleteOrganization(org.id);
      onDeleted();
    } catch (e: any) {
      setError(e.message ?? "No pudimos eliminar la organización.");
      setDeleting(false);
    }
  };

  return (
    <Modal title={`Eliminar "${org.name}"`} onClose={onClose}>
      {memberCount === null ? (
        <p className="note">Comprobando…</p>
      ) : blocked ? (
        <p>
          Esta organización todavía tiene <b>{memberCount}</b> {memberCount === 1 ? "persona" : "personas"} con perfil
          aquí (entrenadores, staff o clientes), estén activos o no. Desactivarlos bloquea su acceso, pero no alcanza
          para poder eliminar la organización: la base de datos protege la organización mientras exista cualquier
          perfil que le pertenezca. Para liberarla necesitarías mover esos perfiles a otra organización.
        </p>
      ) : (
        <>
          <p style={{ marginBottom: 14 }}>
            Esta acción es <b>permanente</b> y no se puede deshacer. No tiene gente adentro, así que es segura, pero
            confírmala escribiendo el nombre exacto de la organización:
          </p>
          <p className="note" style={{ marginBottom: 6 }}><b>{org.name}</b></p>
          <input className="input" style={{ marginBottom: 12 }} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
          <button
            className="btn"
            style={{ background: "var(--bad)", borderColor: "var(--bad)" }}
            onClick={submit}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </>
      )}
    </Modal>
  );
}

function NewOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: OrganizationRow) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Escribe un nombre para poder crear la organización.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      onCreated(await createOrganization(name.trim()));
    } catch (e: any) {
      setError(e.message ?? "No pudimos crear la organización.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nueva organización" onClose={onClose}>
      <label className="field-label">Nombre de la organización</label>
      <input
        className="input"
        style={{ marginBottom: error ? 4 : 18 }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Vértice Training Center"
        autoFocus
      />
      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}
      <p className="note" style={{ marginBottom: 18 }}>Se crea sin entrenadores ni clientes. Después puedes invitar al primer entrenador desde aquí.</p>
      <button className="btn" onClick={submit} disabled={saving}>
        {saving ? "Creando…" : "Crear organización"}
      </button>
    </Modal>
  );
}

function InviteTrainerModal({ org, invitedBy, onClose }: { org: OrganizationRow; invitedBy: string; onClose: () => void }) {
  const { notify } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim()) {
      setError("Escribe el nombre del entrenador.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      setCode(await inviteTrainer({ organizationId: org.id, invitedBy, fullName: fullName.trim(), email: email.trim() }));
    } catch (e: any) {
      setError(e.message ?? "No pudimos crear la invitación.");
    }
    setSaving(false);
  };

  const link = code ? `${window.location.origin}${paths.register}?codigo=${code}` : "";

  return (
    <Modal title={`Invitar entrenador a ${org.name}`} onClose={onClose}>
      {!code ? (
        <>
          <p className="note" style={{ marginBottom: 14 }}>Se crea un código de un solo uso que vence en 14 días.</p>
          <label className="field-label">Nombre completo</label>
          <input className="input" style={{ marginBottom: 12 }} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          <label className="field-label">Email (opcional, fija el código a ese correo)</label>
          <input className="input" style={{ marginBottom: 16 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn" onClick={submit} disabled={saving}>
            {saving ? "Creando…" : "Generar código"}
          </button>
        </>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 12 }}>Comparte este enlace con el entrenador.</p>
          <div style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, letterSpacing: 2, textAlign: "center" }}>
            {code}
          </div>
          <p className="note" style={{ wordBreak: "break-all", marginBottom: 16 }}>{link}</p>
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(link);
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
