import { useEffect, useState } from "react";
import { Plus, UserPlus, Copy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import Chip from "../../components/ui/Chip";
import {
  listOrganizations,
  createOrganization,
  toggleOrganizationStatus,
  inviteTrainer,
  type OrganizationRow,
} from "../../services/admin";
import { paths } from "../../routes/paths";

export default function Organizations() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [inviteFor, setInviteFor] = useState<OrganizationRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setOrgs(await listOrganizations());
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
        <p className="note">Cargando…</p>
      ) : (
        <div className="panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "10px 16px" }}>Organización</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
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
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setInviteFor(o)}>
                          <UserPlus size={13} /> Invitar entrenador
                        </button>
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => toggleStatus(o)}>
                          {o.status === "active" ? "Suspender" : "Reactivar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="note" style={{ padding: 16 }}>Todavía no hay organizaciones.</td>
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
    </div>
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
