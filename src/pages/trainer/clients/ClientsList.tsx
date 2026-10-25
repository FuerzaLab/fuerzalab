import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Copy } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import {
  listClients,
  updateClientStatus,
  createClientWithInvite,
  getLastSignInByProfileId,
  type ClientRow,
  type ClientStatus,
} from "../../../services/clients";
import { paths } from "../../../routes/paths";
import Loading from "../../../components/ui/Loading";

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

export default function ClientsList() {
  const { profile, staffAccess } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ClientStatus>("all");
  const [showInvite, setShowInvite] = useState(false);
  const [toArchive, setToArchive] = useState<ClientRow | null>(null);
  const [lastSignIn, setLastSignIn] = useState<Record<string, string | null>>({});

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const cs = await listClients();
      setClients(cs);
      const profileIds = cs.map((c) => c.profile_id).filter((id): id is string => !!id);
      setLastSignIn(await getLastSignInByProfileId(profileIds));
    } catch (err: any) {
      setLoadError(err.message ?? "No pudimos cargar tus clientes.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "all" || c.status === filter)
      ),
    [clients, query, filter]
  );

  const changeStatus = async (client: ClientRow, status: ClientStatus) => {
    try {
      await updateClientStatus(client.id, status);
      setClients((cs) => cs.map((c) => (c.id === client.id ? { ...c, status } : c)));
      notify(`${client.full_name}: ahora está "${STATUS_LABEL[status]}".`);
    } catch (err: any) {
      notify(`No se pudo actualizar: ${err.message}`);
    }
  };

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Clientes</h1>
          <p className="note">
            {staffAccess?.clientScope === "assigned"
              ? `${clients.length} cliente${clients.length === 1 ? "" : "s"} que te asignó ${staffAccess.trainerName}`
              : `${clients.length} clientes en tu cartera`}
          </p>
        </div>
        {/* Invitar clientes nuevos queda reservado al entrenador (la base de datos tampoco se lo permite al staff). */}
        {profile.role === "trainer" && (
          <button className="btn" onClick={() => setShowInvite(true)}>
            <UserPlus size={16} /> Invitar cliente
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar cliente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar cliente"
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "active", "paused", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn ghost"
              style={{
                padding: "6px 12px",
                fontSize: 13,
                background: filter === f ? "var(--pri)" : "transparent",
                color: filter === f ? "#fff" : "var(--pri)",
              }}
            >
              {f === "all" ? "Todos" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="error-text" style={{ marginBottom: 14 }}>{loadError}</p>}
      {loading ? (
        <Loading />
      ) : (
        <div className="panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "10px 16px" }}>Cliente</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
                  <th style={{ padding: "10px 16px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td
                      style={{ padding: "11px 16px", cursor: "pointer" }}
                      onClick={() => navigate(paths.trainerClientDetail(c.id))}
                    >
                      <b>{c.full_name}</b>
                      {c.email && <div className="note">{c.email}</div>}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Chip tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Chip>
                        {!c.profile_id && <Chip tone="warn">Sin aceptar invitación</Chip>}
                      </div>
                      {c.profile_id && (
                        <div className="note" style={{ marginTop: 3 }}>
                          {lastSignIn[c.profile_id] ? `Último ingreso: ${new Date(lastSignIn[c.profile_id]!).toLocaleDateString("es")}` : "Todavía no ingresó"}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.status !== "active" && (
                          <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => changeStatus(c, "active")}>
                            Reactivar
                          </button>
                        )}
                        {c.status === "active" && (
                          <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => changeStatus(c, "paused")}>
                            Suspender
                          </button>
                        )}
                        {c.status !== "archived" && (
                          <button
                            className="btn ghost"
                            style={{ padding: "5px 10px", fontSize: 13, color: "var(--bad)" }}
                            onClick={() => setToArchive(c)}
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="note" style={{ padding: 16 }}>
                      Ningún cliente coincide con el filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteClientModal
          organizationId={profile.organization_id!}
          trainerId={profile.id}
          onClose={() => setShowInvite(false)}
          onCreated={(client) => {
            setClients((cs) => [client, ...cs]);
          }}
        />
      )}

      {toArchive && (
        <ConfirmModal
          title="Dar de baja"
          message={`¿Dar de baja a ${toArchive.full_name}? Su historial se conserva y no podrá entrar a la plataforma. Puedes reactivarlo cuando quieras.`}
          confirmLabel="Dar de baja"
          danger
          onClose={() => setToArchive(null)}
          onConfirm={async () => {
            await changeStatus(toArchive, "archived");
            setToArchive(null);
          }}
        />
      )}
    </div>
  );
}

function InviteClientModal({
  organizationId,
  trainerId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onCreated: (client: ClientRow) => void;
}) {
  const { notify } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { client, code: inviteCode } = await createClientWithInvite({
        organizationId,
        trainerId,
        fullName: fullName.trim(),
        email: email.trim(),
      });
      onCreated(client);
      setCode(inviteCode);
    } catch (err: any) {
      setError(err.message ?? "No pudimos crear la invitación.");
    }
    setLoading(false);
  };

  const link = code ? `${window.location.origin}${paths.register}?codigo=${code}` : "";

  return (
    <Modal title="Invitar cliente" onClose={onClose}>
      {!code ? (
        <>
          <p className="note" style={{ marginBottom: 14 }}>
            Se crea la ficha del cliente y un código de un solo uso que vence en 14 días.
          </p>
          <label className="field-label">Nombre completo</label>
          <input className="input" style={{ marginBottom: 12 }} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          <label className="field-label">Email (opcional, fija el código a ese correo)</label>
          <input className="input" style={{ marginBottom: 16 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? "Creando…" : "Generar código"}
          </button>
        </>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 12 }}>Comparte este enlace. Al registrarse, la cuenta queda vinculada automáticamente.</p>
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
