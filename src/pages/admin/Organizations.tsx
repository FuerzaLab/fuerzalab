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
import { listPlatformPlans, type PlatformPlanRow } from "../../services/billing";
import { orgClientCounts, orgPeriodAmount, refreshAllOrgBilling, setOrgBillingSettings } from "../../services/orgBilling";

export default function Organizations() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [inviteFor, setInviteFor] = useState<OrganizationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationRow | null>(null);
  const [trainers, setTrainers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<PlatformPlanRow[]>([]);
  const [billingOrg, setBillingOrg] = useState<OrganizationRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, u] = await Promise.all([listOrganizations(), listUsers().catch((err: any): UserRow[] => {
        notify(`No se pudo cargar la lista de entrenadores: ${err.message}`);
        return [];
      })]);
      setOrgs(o);
      setTrainers(u.filter((x) => x.role === "trainer"));
      await refreshAllOrgBilling(); // recalcula vencimientos y bloqueos antes de mostrar
      setPlans(await listPlatformPlans().catch((): PlatformPlanRow[] => []));
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
                  <th style={{ padding: "10px 16px" }}>Cobro</th>
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
                    <td style={{ padding: "11px 16px", minWidth: 190 }}>
                      <OrgBillingCell org={o} plans={plans} onEdit={() => setBillingOrg(o)} />
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
                    <td colSpan={5} className="note" style={{ padding: 16 }}>Todavía no hay organizaciones.</td>
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

      {billingOrg && (
        <OrgBillingModal
          org={billingOrg}
          plans={plans}
          onClose={() => setBillingOrg(null)}
          onSaved={(fields) => {
            setOrgs((xs) => xs.map((x) => (x.id === billingOrg.id ? { ...x, ...fields } : x)));
            setBillingOrg(null);
            notify("Cobro de la organización guardado.");
            load();
          }}
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

const fmtD = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" });

/** Estado de cobro en la fila de cada organización. */
function OrgBillingCell({ org, plans, onEdit }: { org: OrganizationRow; plans: PlatformPlanRow[]; onEdit: () => void }) {
  const plan = plans.find((p) => p.id === org.plan_id);
  const today = new Date().toISOString().slice(0, 10);
  let chip: { tone: "ok" | "warn" | "bad" | "pri"; text: string } | null = null;
  if (org.billing_exempt) chip = { tone: "pri", text: "Sin cobro" };
  else if (org.billing_blocked_since && org.billing_blocked_since <= today) chip = { tone: "bad", text: `Bloqueada desde ${fmtD(org.billing_blocked_since)}` };
  else if (org.trial_ends_at && org.trial_ends_at.slice(0, 10) >= today) chip = { tone: "warn", text: `Prueba hasta ${fmtD(org.trial_ends_at)}` };
  else if (org.limit_exceeded_since) chip = { tone: "warn", text: "Superó el tope" };
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <span style={{ fontSize: 13.5 }}>{org.billing_exempt ? "—" : plan ? plan.name : <span className="note">Sin plan</span>}</span>
      {chip && <Chip tone={chip.tone}>{chip.text}</Chip>}
      <button className="link-btn" style={{ fontSize: 12.5 }} onClick={onEdit}>Plan y prueba</button>
    </div>
  );
}

/** Plan, prueba gratis y "sin cobro" de una organización. */
function OrgBillingModal({
  org,
  plans,
  onClose,
  onSaved,
}: {
  org: OrganizationRow;
  plans: PlatformPlanRow[];
  onClose: () => void;
  onSaved: (fields: Partial<OrganizationRow>) => void;
}) {
  const [planId, setPlanId] = useState(org.plan_id ?? "");
  const [trial, setTrial] = useState(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : "");
  const [exempt, setExempt] = useState(!!org.billing_exempt);
  const [trialFree, setTrialFree] = useState(String((org as any).trial_free_clients ?? 3));
  const [counts, setCounts] = useState<{ active: number; counted: number } | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    orgClientCounts(org.id).then(setCounts).catch(() => {});
  }, [org.id]);
  useEffect(() => {
    setEstimate(null);
    if (planId) orgPeriodAmount(org.id, planId).then(setEstimate);
  }, [org.id, planId]);

  const plan = plans.find((p) => p.id === planId);
  const save = async () => {
    setSaving(true);
    setError("");
    const fields = {
      plan_id: planId || null,
      trial_ends_at: trial ? new Date(trial + "T23:59:00").toISOString() : null,
      billing_exempt: exempt,
      ...((org as any).trial_free_clients !== undefined || trialFree !== "3" ? { trial_free_clients: Number(trialFree || 0) } : {}),
    };
    try {
      await setOrgBillingSettings(org.id, fields);
      onSaved(fields);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Cobro — ${org.name}`} onClose={onClose}>
      <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
        <span>Sin cobro (por ejemplo, la demo o tu propia organización)</span>
      </label>
      {!exempt && (
        <>
          <label className="field-label">Plan</label>
          <select className="input" style={{ marginBottom: 6 }} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Sin plan</option>
            {plans.filter((p) => p.is_active || p.id === org.plan_id).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.currency} {p.price}</option>
            ))}
          </select>
          <p className="note" style={{ fontSize: 13, margin: "0 0 14px" }}>
            {counts ? `${counts.active} alumnos activos${counts.counted > counts.active ? ` (+${counts.counted - counts.active} invitados sin aceptar)` : ""}` : "Contando alumnos…"}
            {plan?.client_limit != null && ` · tope del plan: ${plan.client_limit}`}
            {estimate != null && plan && ` · próximo período: ${plan.currency} ${estimate.toLocaleString("es")}`}
          </p>
          <label className="field-label">Prueba gratis hasta (vacío = sin prueba)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
            <input className="input" type="date" value={trial} onChange={(e) => setTrial(e.target.value)} />
            <div>
              <input className="input" inputMode="numeric" value={trialFree} onChange={(e) => setTrialFree(e.target.value.replace(/\D/g, ""))} aria-label="Alumnos gratis en la prueba" />
              <div className="note" style={{ fontSize: 12 }}>alumnos gratis en la prueba</div>
            </div>
          </div>
          <p className="note" style={{ fontSize: 12.5, margin: "0 0 14px" }}>
            Las organizaciones nuevas empiezan con 14 días. Si la prueba termina y no hay ningún cobro registrado, al día siguiente se
            suspende el acceso. Para que no pase, registra su primer cobro en Pagos de la plataforma.
          </p>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
      <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
    </Modal>
  );
}
