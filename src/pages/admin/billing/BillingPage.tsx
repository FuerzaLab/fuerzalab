import { useEffect, useState } from "react";
import { Plus, Pencil, Check } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import Chip from "../../../components/ui/Chip";
import { listOrganizations, type OrganizationRow } from "../../../services/admin";
import {
  listPlatformPlans,
  createPlatformPlan,
  updatePlatformPlan,
  setPlatformPlanActive,
  listOrganizationSubscriptions,
  createOrganizationSubscription,
  markSubscriptionPaid,
  updateOrganizationSubscription,
  BILLING_PERIOD_LABEL,
  type PlatformPlanRow,
  type OrganizationSubscriptionRow,
  type SubscriptionStatus,
} from "../../../services/billing";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending: "Pendiente",
  paid: "Al día",
  overdue: "Vencido",
  cancelled: "Cancelado",
};
const STATUS_TONE: Record<SubscriptionStatus, "ok" | "warn" | "bad" | ""> = {
  pending: "warn",
  paid: "ok",
  overdue: "bad",
  cancelled: "",
};

export default function BillingPage() {
  const { notify } = useToast();
  const [plans, setPlans] = useState<PlatformPlanRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [subs, setSubs] = useState<OrganizationSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformPlanRow | null>(null);
  const [registeringFor, setRegisteringFor] = useState<OrganizationRow | null>(null);
  const [editingSub, setEditingSub] = useState<OrganizationSubscriptionRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o, s] = await Promise.all([listPlatformPlans(), listOrganizations(), listOrganizationSubscriptions()]);
      setPlans(p);
      setOrgs(o);
      setSubs(s);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestSubFor = (orgId: string): OrganizationSubscriptionRow | null => {
    const forOrg = subs.filter((s) => s.organization_id === orgId);
    if (!forOrg.length) return null;
    return forOrg.reduce((latest, s) => (s.due_date > latest.due_date ? s : latest), forOrg[0]);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Pagos de la plataforma</h1>
      <p className="note" style={{ marginBottom: 20 }}>
        Esto es lo que cada organización te paga a vos por usar FuerzaLab — separado de "Pagos" del entrenador, que es lo que sus clientes le pagan a él.
      </p>

      {loading ? (
        <p className="note">Cargando…</p>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="hd">
              <h3>Planes</h3>
              <button className="btn" onClick={() => setShowNewPlan(true)}><Plus size={16} /> Nuevo plan</button>
            </div>
            <div className="bd" style={{ display: "grid", gap: 8 }}>
              {plans.length === 0 && <p className="note">Todavía no creaste ningún plan.</p>}
              {plans.map((plan) => (
                <div key={plan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)", opacity: plan.is_active ? 1 : 0.5 }}>
                  <div>
                    <b>{plan.name}</b>{" "}
                    <span className="note">
                      {plan.currency} {plan.price} · {BILLING_PERIOD_LABEL[plan.billing_period]} · {plan.client_limit ? `hasta ${plan.client_limit} clientes` : "clientes ilimitados"} · {plan.trainer_limit ? `hasta ${plan.trainer_limit} entrenadores` : "entrenadores ilimitados"}
                      {!plan.is_active ? " · inactivo" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditingPlan(plan)}><Pencil size={12} /> Editar</button>
                    <button
                      className="btn ghost"
                      style={{ padding: "4px 10px", fontSize: 12.5 }}
                      onClick={async () => {
                        await setPlatformPlanActive(plan.id, !plan.is_active);
                        setPlans((ps) => ps.map((p) => (p.id === plan.id ? { ...p, is_active: !p.is_active } : p)));
                      }}
                    >
                      {plan.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Organizaciones</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                    <th style={{ padding: "10px 16px" }}>Organización</th>
                    <th style={{ padding: "10px 16px" }}>Plan</th>
                    <th style={{ padding: "10px 16px" }}>Vencimiento</th>
                    <th style={{ padding: "10px 16px" }}>Estado</th>
                    <th style={{ padding: "10px 16px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const sub = latestSubFor(org.id);
                    const effectiveStatus: SubscriptionStatus | null = sub ? (sub.status === "pending" && sub.due_date < today ? "overdue" : sub.status) : null;
                    return (
                      <tr key={org.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={{ padding: "11px 16px" }}>{org.name}</td>
                        <td style={{ padding: "11px 16px" }}>{sub?.plan_name ?? "—"}</td>
                        <td style={{ padding: "11px 16px" }}>{sub ? new Date(sub.due_date).toLocaleDateString("es") : "—"}</td>
                        <td style={{ padding: "11px 16px" }}>
                          {effectiveStatus ? <Chip tone={STATUS_TONE[effectiveStatus]}>{STATUS_LABEL[effectiveStatus]}</Chip> : <span className="note">Sin registrar</span>}
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {sub && sub.status !== "paid" && (
                              <button
                                className="btn ghost"
                                style={{ padding: "5px 10px", fontSize: 13 }}
                                onClick={async () => {
                                  await markSubscriptionPaid(sub.id);
                                  setSubs((ss) => ss.map((s) => (s.id === sub.id ? { ...s, status: "paid", paid_at: new Date().toISOString() } : s)));
                                  notify("Marcado como pagado.");
                                }}
                              >
                                <Check size={13} /> Marcar pagado
                              </button>
                            )}
                            {sub && (
                              <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setEditingSub(sub)}>
                                <Pencil size={13} /> Editar
                              </button>
                            )}
                            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setRegisteringFor(org)}>
                              <Plus size={13} /> Registrar pago
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(showNewPlan || editingPlan) && (
        <PlanModal
          plan={editingPlan}
          onClose={() => {
            setShowNewPlan(false);
            setEditingPlan(null);
          }}
          onSaved={async () => {
            setShowNewPlan(false);
            setEditingPlan(null);
            await load();
            notify(editingPlan ? "Plan actualizado." : "Plan creado.");
          }}
        />
      )}

      {registeringFor && (
        <SubscriptionModal
          organization={registeringFor}
          plans={plans}
          onClose={() => setRegisteringFor(null)}
          onSaved={async () => {
            setRegisteringFor(null);
            await load();
            notify("Pago registrado.");
          }}
        />
      )}

      {editingSub && (
        <EditSubscriptionModal
          sub={editingSub}
          onClose={() => setEditingSub(null)}
          onSaved={async () => {
            setEditingSub(null);
            await load();
            notify("Actualizado.");
          }}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: PlatformPlanRow | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState(plan?.name ?? "");
  const [clientLimit, setClientLimit] = useState(plan?.client_limit != null ? String(plan.client_limit) : "");
  const [trainerLimit, setTrainerLimit] = useState(plan?.trainer_limit != null ? String(plan.trainer_limit) : "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [currency, setCurrency] = useState(plan?.currency ?? "Bs");
  const [period, setPeriod] = useState<PlatformPlanRow["billing_period"]>(plan?.billing_period ?? "monthly");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !price) {
      setError("Completa el nombre y el precio.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        clientLimit: clientLimit ? Number(clientLimit) : null,
        trainerLimit: trainerLimit ? Number(trainerLimit) : null,
        price: Number(price),
        currency,
        billingPeriod: period,
      };
      if (plan) await updatePlatformPlan(plan.id, fields);
      else await createPlatformPlan(fields);
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar el plan.");
      setSaving(false);
    }
  };

  return (
    <Modal title={plan ? `Editar "${plan.name}"` : "Nuevo plan"} onClose={onClose}>
      <label className="field-label">Nombre del plan</label>
      <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Arranque, Profesional, Estudio" autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Precio</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="field-label">Periodicidad</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as PlatformPlanRow["billing_period"])}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="field-label">Límite de clientes (vacío = sin límite)</label>
          <input className="input" inputMode="numeric" value={clientLimit} onChange={(e) => setClientLimit(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <label className="field-label">Límite de entrenadores (vacío = sin límite)</label>
          <input className="input" inputMode="numeric" value={trainerLimit} onChange={(e) => setTrainerLimit(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : plan ? "Guardar cambios" : "Crear plan"}</button>
    </Modal>
  );
}

function SubscriptionModal({
  organization,
  plans,
  onClose,
  onSaved,
}: {
  organization: OrganizationRow;
  plans: PlatformPlanRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("Bs");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<SubscriptionStatus>("pending");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const applyPlan = (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      setAmount(String(plan.price));
      setCurrency(plan.currency);
    }
  };

  const submit = async () => {
    if (!amount) {
      setError("Completa el monto.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createOrganizationSubscription({
        organizationId: organization.id,
        platformPlanId: planId || null,
        status,
        amount: Number(amount),
        currency,
        dueDate,
        method,
        notes,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "No pudimos registrar el pago.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Registrar pago — ${organization.name}`} onClose={onClose}>
      <label className="field-label">Plan (opcional, completa el monto)</label>
      <select className="input" style={{ marginBottom: 12 }} value={planId} onChange={(e) => applyPlan(e.target.value)}>
        <option value="">Sin plan</option>
        {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.currency} {p.price}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Monto</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="field-label">Vencimiento</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Estado</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="field-label">Método (opcional)</label>
          <input className="input" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Ej. Transferencia, QR" />
        </div>
      </div>
      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 50, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Registrando…" : "Registrar"}</button>
    </Modal>
  );
}

function EditSubscriptionModal({
  sub,
  onClose,
  onSaved,
}: {
  sub: OrganizationSubscriptionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(sub.amount));
  const [currency, setCurrency] = useState(sub.currency);
  const [dueDate, setDueDate] = useState(sub.due_date.slice(0, 10));
  const [status, setStatus] = useState<SubscriptionStatus>(sub.status);
  const [method, setMethod] = useState(sub.method ?? "");
  const [notes, setNotes] = useState(sub.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!amount) {
      setError("Completa el monto.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateOrganizationSubscription(sub.id, { status, amount: Number(amount), currency, dueDate, method, notes });
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar los cambios.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar pago" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Monto</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="field-label">Vencimiento</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Estado</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="overdue">Vencido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="field-label">Método</label>
          <input className="input" value={method} onChange={(e) => setMethod(e.target.value)} />
        </div>
      </div>
      <label className="field-label">Notas</label>
      <textarea className="input" style={{ minHeight: 50, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
    </Modal>
  );
}
