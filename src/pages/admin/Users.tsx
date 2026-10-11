import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { listUsers, toggleUserActive, type UserRow } from "../../services/admin";
import type { Role } from "../../types/auth";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  trainer: "Entrenador",
  staff: "Staff",
  client: "Cliente",
};

export default function Users() {
  const { notify } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
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
      <p className="note" style={{ marginBottom: 20 }}>Entrenadores, staff y clientes de todas las organizaciones.</p>

      {loading ? (
        <p className="note">Cargando…</p>
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
                    <td style={{ padding: "11px 16px" }}>
                      <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => toggle(u)}>
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>
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
    </div>
  );
}
