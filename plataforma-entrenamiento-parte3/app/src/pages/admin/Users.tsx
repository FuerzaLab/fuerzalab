import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import Chip from "../../components/ui/Chip";
import {
  listUsers,
  toggleUserActive,
  listOrganizations,
  countClientsByTrainer,
  moveTrainerToOrganization,
  listInvitations,
  revokeInvitation,
  type UserRow,
  type OrganizationRow,
  type InvitationRow,
} from "../../services/admin";
import type { Role } from "../../types/auth";
import Loading from "../../components/ui/Loading";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  trainer: "Entrenador",
  staff: "Staff",
  client: "Cliente",
};

export default function Users() {
  const { notify } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [clientCounts, setClientCounts] = useState<Record<string, number>>({});
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveTarget, setMoveTarget] = useState<UserRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const us = await listUsers();
      setUsers(us);
      setOrgs(await listOrganizations());
      const trainerIds = us.filter((u) => u.role === "trainer").map((u) => u.id);
      setClientCounts(await countClientsByTrainer(trainerIds));
      setInvitations(await listInvitations("trainer"));
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (u: UserRow) => {
    try {
      await toggleUserActive(u.id, !u.is_active);
      setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
      notify(`${u.full_name}: ahora está "${!u.is_active ? "Activo" : "Inactivo"}".`);
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Usuarios</h1>
      <p className="note" style={{ marginBottom: 6 }}>Entrenadores, staff y clientes de todas las organizaciones.</p>
      <p className="note" style={{ marginBottom: 20 }}>
        No es posible eliminar una cuenta por completo desde aquí (requeriría una pieza técnica adicional que
        quedó fuera del alcance de este proyecto, igual que el envío automático de correos). "Desactivar" bloquea
        por completo el acceso de esa persona, que es el efecto práctico que buscarías con un borrado.
      </p>

      {!loading && invitations.some((i) => i.status === "pending" || i.status === "expired") && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="hd"><h3>Invitaciones de entrenador sin aceptar</h3></div>
          <div className="bd" style={{ display: "grid", gap: 10 }}>
            {invitations
              .filter((i) => i.status === "pending" || i.status === "expired")
              .map((i) => {
                const isExpired = i.status === "expired" || new Date(i.expires_at) < new Date();
                return (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                    <span>
                      <b>{i.full_name || i.email || "Sin nombre"}</b>
                      {i.email && <span className="note"> — {i.email}</span>}
                      <div className="note">{orgs.find((o) => o.id === i.organization_id)?.name ?? "Organización"} · Invitado el {new Date(i.created_at).toLocaleDateString("es")}</div>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Chip tone={isExpired ? "bad" : "warn"}>{isExpired ? "Vencida" : "Pendiente"}</Chip>
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12.5 }}
                        onClick={async () => {
                          await revokeInvitation(i.id);
                          setInvitations((inv) => inv.filter((x) => x.id !== i.id));
                          notify("Invitación revocada.");
                        }}
                      >
                        Revocar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "10px 16px" }}>Nombre</th>
                  <th style={{ padding: "10px 16px" }}>Rol</th>
                  <th style={{ padding: "10px 16px" }}>Organización</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
                  <th style={{ padding: "10px 16px" }}>Último ingreso</th>
                  <th style={{ padding: "10px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "11px 16px" }}>
                      <b>{u.full_name}</b>
                      <div className="note">{u.email}</div>
                    </td>
                    <td style={{ padding: "11px 16px" }}>{ROLE_LABEL[u.role]}</td>
                    <td style={{ padding: "11px 16px" }}>{u.organizations?.name ?? "—"}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <Chip tone={u.is_active ? "ok" : "bad"}>{u.is_active ? "Activo" : "Inactivo"}</Chip>
                    </td>
                    <td style={{ padding: "11px 16px" }} className="note">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("es") : "Nunca"}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => toggle(u)}>
                          {u.is_active ? "Desactivar" : "Activar"}
                        </button>
                        {u.role === "trainer" && (
                          <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setMoveTarget(u)}>
                            Mover de organización
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="note" style={{ padding: 16 }}>Todavía no hay usuarios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {moveTarget && (
        <MoveTrainerModal
          trainer={moveTarget}
          orgs={orgs}
          clientCount={clientCounts[moveTarget.id] ?? 0}
          onClose={() => setMoveTarget(null)}
          onMoved={(orgId, orgName) => {
            setUsers((us) => us.map((u) => (u.id === moveTarget.id ? { ...u, organization_id: orgId, organizations: { name: orgName } } : u)));
            setMoveTarget(null);
            notify(`${moveTarget.full_name} ahora pertenece a ${orgName}.`);
          }}
        />
      )}
    </div>
  );
}

function MoveTrainerModal({
  trainer,
  orgs,
  clientCount,
  onClose,
  onMoved,
}: {
  trainer: UserRow;
  orgs: OrganizationRow[];
  clientCount: number;
  onClose: () => void;
  onMoved: (orgId: string, orgName: string) => void;
}) {
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const blocked = clientCount > 0;

  const submit = async () => {
    if (!orgId) {
      setError("Elige la organización de destino.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await moveTrainerToOrganization(trainer.id, orgId);
      onMoved(orgId, orgs.find((o) => o.id === orgId)?.name ?? "");
    } catch (e: any) {
      setError(e.message ?? "No pudimos mover a este entrenador.");
    }
    setSaving(false);
  };

  return (
    <Modal title={`Mover a ${trainer.full_name}`} onClose={onClose}>
      {blocked ? (
        <p>
          Este entrenador todavía tiene <b>{clientCount}</b> {clientCount === 1 ? "cliente asignado" : "clientes asignados"}.
          No se puede mover mientras tenga clientes: perdería el acceso a ellos al instante, porque sus clientes se
          quedarían en la organización anterior mientras él pasa a la nueva. Primero reasigna o da de baja a esos
          clientes.
        </p>
      ) : (
        <>
          <label className="field-label">Nueva organización</label>
          <select className="input" style={{ marginBottom: 16 }} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Selecciona</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn" onClick={submit} disabled={saving}>{saving ? "Moviendo…" : "Mover"}</button>
        </>
      )}
    </Modal>
  );
}
