import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Check, ExternalLink, Pencil } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import Chip from "../../../components/ui/Chip";
import { listClients, type ClientRow, type ClientStatus } from "../../../services/clients";
import { paths } from "../../../routes/paths";
import {
  listPaymentPlans,
  createPaymentPlan,
  updatePaymentPlan,
  listPayments,
  createPayment,
  updatePayment,
  markPaymentPaid,
  getReceiptUrl,
  subscribeClientToPlan,
  type PaymentPlanRow,
  type PaymentRow,
  type PaymentStatus,
  type PaymentMethod,
} from "../../../services/payments";
import Loading from "../../../components/ui/Loading";
import SearchSelect from "../../../components/ui/SearchSelect";

const STATUS_LABEL: Record<PaymentStatus, string> = { pending: "Pendiente", paid: "Pagado", cancelled: "Cancelado" };
const STATUS_TONE: Record<PaymentStatus, "warn" | "ok" | "bad"> = { pending: "warn", paid: "ok", cancelled: "bad" };
const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = { prospect: "Prospecto", active: "Activo", paused: "En pausa", archived: "Dado de baja" };
const CLIENT_STATUS_TONE: Record<ClientStatus, "ok" | "warn" | "bad" | ""> = { prospect: "", active: "ok", paused: "warn", archived: "bad" };

export default function PaymentsPage() {
  const { profile, actingTrainerId } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [plans, setPlans] = useState<PaymentPlanRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentPlanRow | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cs, ps, pays] = await Promise.all([listClients(), listPaymentPlans(), listPayments()]);
      setClients(cs);
      setPlans(ps);
      setPayments(pays);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name ?? "(cliente)";
  const totalPending = payments.filter((p) => p.status === "pending").reduce((t, p) => t + p.amount, 0);
  const totalPaidThisMonth = payments
    .filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at).getMonth() === new Date().getMonth())
    .reduce((t, p) => t + p.amount, 0);

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Pagos</h1>
          <p className="note">Toca el nombre de un cliente para abrir su ficha y suspenderlo o darlo de baja.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => setShowNewPlan(true)}><Plus size={16} /> Nuevo plan</button>
          <button className="btn" onClick={() => setShowNewPayment(true)}><Plus size={16} /> Registrar pago</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 20 }}>
        <div className="panel"><div className="bd">
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700 }}>{totalPending.toLocaleString("es")}</div>
          <div className="note">Pendiente de cobro</div>
        </div></div>
        <div className="panel"><div className="bd">
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700 }}>{totalPaidThisMonth.toLocaleString("es")}</div>
          <div className="note">Cobrado este mes</div>
        </div></div>
      </div>

      {!loading && plans.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="hd"><h3>Planes</h3></div>
          <div className="bd" style={{ display: "grid", gap: 8 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <b>{plan.name}</b>{" "}
                  <span className="note">{plan.currency} {plan.price} · {plan.billing_period === "monthly" ? "Mensual" : plan.billing_period === "quarterly" ? "Trimestral" : "Personalizada"}</span>
                </div>
                <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditingPlan(plan)}>
                  <Pencil size={12} /> Editar
                </button>
              </div>
            ))}
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
                  <th style={{ padding: "10px 16px" }}>Cliente</th>
                  <th style={{ padding: "10px 16px" }}>Plan</th>
                  <th style={{ padding: "10px 16px" }}>Monto</th>
                  <th style={{ padding: "10px 16px" }}>Vencimiento</th>
                  <th style={{ padding: "10px 16px" }}>Fecha de pago</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
                  <th style={{ padding: "10px 16px" }}>Comprobante</th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "11px 16px" }}>
                      <button
                        onClick={() => navigate(paths.trainerClientDetail(p.client_id))}
                        style={{ border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}
                      >
                        <b>{clientName(p.client_id)}</b>
                      </button>
                      {(() => {
                        const c = clients.find((c) => c.id === p.client_id);
                        return c ? <div><Chip tone={CLIENT_STATUS_TONE[c.status]}>{CLIENT_STATUS_LABEL[c.status]}</Chip></div> : null;
                      })()}
                    </td>
                    <td style={{ padding: "11px 16px" }}>{p.plan_name ?? <span className="note">Sin plan</span>}</td>
                    <td style={{ padding: "11px 16px" }}>{p.currency} {p.amount.toLocaleString("es")}</td>
                    <td style={{ padding: "11px 16px" }}>{new Date(p.due_date).toLocaleDateString("es")}</td>
                    <td style={{ padding: "11px 16px" }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString("es") : <span className="note">—</span>}</td>
                    <td style={{ padding: "11px 16px" }}><Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip></td>
                    <td style={{ padding: "11px 16px" }}>
                      {p.receipt_path ? (
                        <button
                          className="btn ghost"
                          style={{ padding: "4px 10px", fontSize: 12.5 }}
                          onClick={async () => window.open(await getReceiptUrl(p.receipt_path!), "_blank")}
                        >
                          <ExternalLink size={12} /> Ver
                        </button>
                      ) : (
                        <span className="note">—</span>
                      )}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.status === "pending" && (
                          <button
                            className="btn ghost"
                            style={{ padding: "5px 10px", fontSize: 13 }}
                            onClick={async () => {
                              await markPaymentPaid(p.id);
                              setPayments((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: "paid", paid_at: new Date().toISOString() } : x)));
                              notify("Marcado como pagado");
                            }}
                          >
                            <Check size={13} /> Marcar pagado
                          </button>
                        )}
                        <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setEditingPayment(p)}>
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={8} className="note" style={{ padding: 16 }}>Todavía no hay pagos registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewPlan && (
        <NewPlanModal
          organizationId={profile.organization_id!}
          trainerId={(actingTrainerId ?? profile.id)}
          onClose={() => setShowNewPlan(false)}
          onCreated={(plan) => {
            setPlans((ps) => [...ps, plan]);
            setShowNewPlan(false);
            notify(`Plan "${plan.name}" creado.`);
          }}
        />
      )}

      {showNewPayment && (
        <NewPaymentModal
          organizationId={profile.organization_id!}
          trainerId={(actingTrainerId ?? profile.id)}
          clients={clients}
          plans={plans}
          onClose={() => setShowNewPayment(false)}
          onCreated={(payment) => {
            setPayments((ps) => [payment, ...ps]);
            setShowNewPayment(false);
            notify("Pago registrado.");
          }}
        />
      )}

      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={(fields) => {
            setPlans((ps) => ps.map((x) => (x.id === editingPlan.id ? { ...x, ...fields } : x)));
            setEditingPlan(null);
            notify("Plan actualizado.");
          }}
        />
      )}

      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSaved={(fields) => {
            setPayments((ps) => ps.map((x) => (x.id === editingPayment.id ? { ...x, ...fields, paid_at: fields.status === "paid" ? x.paid_at ?? new Date().toISOString() : null } : x)));
            setEditingPayment(null);
            notify("Pago actualizado.");
          }}
        />
      )}
    </div>
  );
}

function NewPlanModal({
  organizationId,
  trainerId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onCreated: (p: PaymentPlanRow) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("Bs");
  const [period, setPeriod] = useState<PaymentPlanRow["billing_period"]>("monthly");
  const [description, setDescription] = useState("");
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
      onCreated(await createPaymentPlan({ organizationId, trainerId, name: name.trim(), price: Number(price), currency, billingPeriod: period, description }));
    } catch (e: any) {
      setError(e.message ?? "No pudimos crear el plan.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nuevo plan" onClose={onClose}>
      <label className="field-label">Nombre del plan</label>
      <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Precio</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs (bolivianos)</option>
            <option value="USD">USD (dólares)</option>
          </select>
        </div>
        <div>
          <label className="field-label">Periodicidad</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as PaymentPlanRow["billing_period"])}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>
      </div>
      <label className="field-label">Descripción (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Creando…" : "Crear plan"}</button>
    </Modal>
  );
}

function EditPlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: PaymentPlanRow;
  onClose: () => void;
  onSaved: (fields: { name: string; price: number; currency: string; billing_period: PaymentPlanRow["billing_period"]; description: string | null }) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [currency, setCurrency] = useState(plan.currency);
  const [period, setPeriod] = useState<PaymentPlanRow["billing_period"]>(plan.billing_period);
  const [description, setDescription] = useState(plan.description ?? "");
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
      await updatePaymentPlan(plan.id, { name: name.trim(), price: Number(price), currency, billingPeriod: period, description });
      onSaved({ name: name.trim(), price: Number(price), currency, billing_period: period, description: description || null });
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar los cambios.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Editar "${plan.name}"`} onClose={onClose}>
      <label className="field-label">Nombre del plan</label>
      <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Precio</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs (bolivianos)</option>
            <option value="USD">USD (dólares)</option>
          </select>
        </div>
        <div>
          <label className="field-label">Periodicidad</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as PaymentPlanRow["billing_period"])}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>
      </div>
      <label className="field-label">Descripción (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <p className="note" style={{ marginBottom: 12 }}>Esto no cambia los pagos que ya registraste con este plan — solo el plan en sí, para las próximas veces que lo uses.</p>
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
    </Modal>
  );
}

function NewPaymentModal({
  organizationId,
  trainerId,
  clients,
  plans,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  clients: ClientRow[];
  plans: PaymentPlanRow[];
  onClose: () => void;
  onCreated: (p: PaymentRow) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("Bs");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [method, setMethod] = useState<PaymentMethod | "">("");
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
    if (!clientId || !amount) {
      setError("Elige el cliente y el monto.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      let clientPlanId: string | undefined;
      if (planId) {
        clientPlanId = await subscribeClientToPlan({ organizationId, trainerId, clientId, planId, dueDate });
      }
      onCreated(
        await createPayment({
          organizationId,
          trainerId,
          clientId,
          amount: Number(amount),
          currency,
          dueDate,
          status,
          method: (method || null) as PaymentMethod | null,
          notes,
          clientPlanId,
        })
      );
    } catch (e: any) {
      setError(e.message ?? "No pudimos registrar el pago.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Registrar pago" onClose={onClose}>
      <label className="field-label">Cliente</label>
      <SearchSelect className="input" style={{ marginBottom: 12 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
      </SearchSelect>
      <label className="field-label">Plan (opcional, completa el monto)</label>
      <SearchSelect className="input" style={{ marginBottom: 12 }} value={planId} onChange={(e) => applyPlan(e.target.value)}>
        <option value="">Sin plan</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.currency} {p.price}</option>)}
      </SearchSelect>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Monto</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Bs">Bs (bolivianos)</option>
            <option value="USD">USD (dólares)</option>
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
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="field-label">Método</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="">Sin definir</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="online">En línea</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>
      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 50, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Registrando…" : "Registrar pago"}</button>
    </Modal>
  );
}

function EditPaymentModal({
  payment,
  onClose,
  onSaved,
}: {
  payment: PaymentRow;
  onClose: () => void;
  onSaved: (fields: { amount: number; currency: string; due_date: string; status: PaymentStatus; method: PaymentMethod | null; notes: string | null }) => void;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [currency, setCurrency] = useState(payment.currency);
  const [dueDate, setDueDate] = useState(payment.due_date.slice(0, 10));
  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [method, setMethod] = useState<PaymentMethod | "">(payment.method ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
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
      const fields = { amount: Number(amount), currency, dueDate, status, method: (method || null) as PaymentMethod | null, notes };
      await updatePayment(payment.id, fields);
      onSaved({ amount: fields.amount, currency: fields.currency, due_date: fields.dueDate, status: fields.status, method: fields.method, notes: fields.notes || null });
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
            <option value="Bs">Bs (bolivianos)</option>
            <option value="USD">USD (dólares)</option>
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
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="field-label">Método</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="">Sin definir</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="online">En línea</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>
      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 50, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
    </Modal>
  );
}
