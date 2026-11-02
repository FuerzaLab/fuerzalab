import { useEffect, useState } from "react";
import { orgPeriodAmount } from "../../../services/orgBilling";
import { supabase } from "../../../lib/supabase";
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
import Loading from "../../../components/ui/Loading";
import SearchSelect from "../../../components/ui/SearchSelect";

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
  const [historyFor, setHistoryFor] = useState<OrganizationRow | null>(null);

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
    const forOrg = subs.filter((s) => s.organization_id === orgId && s.kind !== "seats");
    if (!forOrg.length) return null;
    return forOrg.reduce((latest, s) => (s.due_date > latest.due_date ? s : latest), forOrg[0]);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Pagos de la plataforma</h1>
      <p className="note" style={{ marginBottom: 20 }}>
        Esto es lo que cada organización te paga a ti por usar FuerzaLab — separado de "Pagos" del entrenador, que es lo que sus clientes le pagan a él.
      </p>

      {loading ? (
        <Loading />
      ) : (
        <>
          <IncomeSummary orgs={orgs} plans={plans} subs={subs} />
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
                      {plan.currency} {plan.price} · {BILLING_PERIOD_LABEL[plan.billing_period]}
                      {plan.price_per_client ? ` · ${plan.included_clients ?? 0} alumnos incluidos + ${plan.currency} ${plan.price_per_client} por alumno extra` : ""} · {plan.client_limit ? `tope ${plan.client_limit} alumnos` : "sin tope de alumnos"} · {plan.trainer_limit ? `hasta ${plan.trainer_limit} entrenadores` : "entrenadores ilimitados"}
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
                        <td style={{ padding: "11px 16px" }}>{sub ? (sub.kind === "seats" ? `Cupos · ${sub.seats_count ?? 1} alumnos` : sub.plan_name ?? "—") : "—"}</td>
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
                                  notify("Marcado como pagado. Se creó solo el cobro del período siguiente.");
                                  load();
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
                            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setHistoryFor(org)}>
                              Historial
                            </button>
                          </div>
                          {subs
                            .filter((x) => x.organization_id === org.id && x.kind === "seats" && x.status !== "paid" && x.status !== "cancelled")
                            .map((x) => (
                              <div key={x.id} style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <Chip tone="warn">Cupos por pagar: {x.currency} {Number(x.amount).toLocaleString("es")} · {x.seats_count ?? 1} {x.seats_count === 1 ? "alumno" : "alumnos"}</Chip>
                                <button
                                  className="btn ghost"
                                  style={{ padding: "4px 10px", fontSize: 12.5 }}
                                  onClick={async () => {
                                    await markSubscriptionPaid(x.id);
                                    notify("Cupos pagados: los alumnos que esperaban ya están activos.");
                                    load();
                                  }}
                                >
                                  <Check size={13} /> Marcar pagado
                                </button>
                              </div>
                            ))}
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

      {historyFor && (
        <Modal title={`Historial de cobros — ${historyFor.name}`} onClose={() => setHistoryFor(null)} wide>
          <SubsTable rows={subs.filter((x) => x.organization_id === historyFor.id)} />
        </Modal>
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
  const [perClient, setPerClient] = useState(plan?.price_per_client ? String(plan.price_per_client) : "");
  const [included, setIncluded] = useState(plan?.included_clients != null ? String(plan.included_clients) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || (price === "" && !perClient)) {
      setError("Completa el nombre y el precio (o el precio por alumno).");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        clientLimit: clientLimit ? Number(clientLimit) : null,
        trainerLimit: trainerLimit ? Number(trainerLimit) : null,
        price: Number(price || 0),
        currency,
        billingPeriod: period,
        pricePerClient: perClient ? Number(perClient.replace(",", ".")) : 0,
        includedClients: perClient ? Number(included || 0) : null,
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
          <label className="field-label">Precio base</label>
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
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </select>
        </div>
      </div>
      {period === "biweekly" && (
        <p className="note" style={{ marginBottom: 12 }}>
          Pensada para períodos de prueba gratuitos de 15 días — pon el precio en 0 si es justamente eso.
        </p>
      )}
      <div style={{ background: "var(--bg)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>Cobro por alumno (opcional)</b>
        <p className="note" style={{ margin: "2px 0 10px", fontSize: 12.5 }}>
          El monto de cada período es: precio base + (alumnos activos − incluidos) × precio por alumno. Para cobrar solo por
          alumno, pon el precio base y los incluidos en 0.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="field-label">Alumnos incluidos en el precio base</label>
            <input className="input" inputMode="numeric" value={included} onChange={(e) => setIncluded(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 15" />
          </div>
          <div>
            <label className="field-label">Precio por cada alumno extra</label>
            <input className="input" inputMode="decimal" value={perClient} onChange={(e) => setPerClient(e.target.value)} placeholder="Vacío = no cobra por alumno" />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="field-label">Tope máximo de alumnos (vacío = sin tope)</label>
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

  const applyPlan = async (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      setAmount(String(plan.price));
      setCurrency(plan.currency);
      // Con cobro por alumno: base + alumnos activos extra, calculado en la base de datos.
      const total = await orgPeriodAmount(organization.id, id);
      if (total != null) setAmount(String(total));
    }
  };

  // Si la organización ya tiene un plan asignado, se propone ese.
  useEffect(() => {
    const own = (organization as any).plan_id as string | null | undefined;
    if (own && plans.some((p) => p.id === own)) applyPlan(own);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <SearchSelect className="input" style={{ marginBottom: 12 }} value={planId} onChange={(e) => applyPlan(e.target.value)}>
        <option value="">Sin plan</option>
        {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.currency} {p.price}</option>)}
      </SearchSelect>
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
      await updateOrganizationSubscription(sub.id, { status, amount: Number(amount), currency, dueDate, method, notes, amountEdited: Number(amount) !== Number(sub.amount) });
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

// --- Resumen de ingresos, historial y exportación -------------------------

const fmtMoney = (byCur: Record<string, number>) => {
  const parts = Object.entries(byCur).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${Math.round(v).toLocaleString("es")}`);
  return parts.length ? parts.join(" · ") : "0";
};
const addTo = (acc: Record<string, number>, cur: string, v: number) => ({ ...acc, [cur]: (acc[cur] ?? 0) + Number(v) });
const monthKey = (iso: string) => iso.slice(0, 7);
const effective = (x: OrganizationSubscriptionRow, today: string): SubscriptionStatus =>
  x.status === "pending" && x.due_date < today ? "overdue" : x.status;

/** Cuánto ganas: cobrado este mes y el anterior, por cobrar, vencido, ingreso mensual estimado y alumnos activos. */
function IncomeSummary({ orgs, plans, subs }: { orgs: OrganizationRow[]; plans: PlatformPlanRow[]; subs: OrganizationSubscriptionRow[] }) {
  const { notify } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const thisMonth = monthKey(today);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString());
  const [estimate, setEstimate] = useState<Record<string, number> | null>(null);
  const [activeClients, setActiveClients] = useState<number | null>(null);

  let paidThis: Record<string, number> = {};
  let paidLast: Record<string, number> = {};
  let toCollect: Record<string, number> = {};
  let overdue: Record<string, number> = {};
  const overdueOrgs = new Set<string>();
  for (const x of subs) {
    const st = effective(x, today);
    if (x.status === "paid" && x.paid_at) {
      if (monthKey(x.paid_at) === thisMonth) paidThis = addTo(paidThis, x.currency, x.amount);
      if (monthKey(x.paid_at) === lastMonth) paidLast = addTo(paidLast, x.currency, x.amount);
    } else if (st === "pending") toCollect = addTo(toCollect, x.currency, x.amount);
    else if (st === "overdue") {
      overdue = addTo(overdue, x.currency, x.amount);
      overdueOrgs.add(x.organization_id);
    }
  }

  useEffect(() => {
    // Ingreso mensual estimado: lo que cobrarías por mes con los planes y alumnos activos de hoy.
    (async () => {
      const perMonth: Record<string, number> = {};
      const factor = { biweekly: 30 / 14, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 } as const;
      await Promise.all(
        orgs
          .filter((o) => !o.billing_exempt && o.plan_id)
          .map(async (o) => {
            const plan = plans.find((p) => p.id === o.plan_id);
            if (!plan) return;
            const amount = await orgPeriodAmount(o.id, plan.id);
            if (amount == null) return;
            perMonth[plan.currency] = (perMonth[plan.currency] ?? 0) + amount * factor[plan.billing_period];
          }),
      );
      setEstimate(perMonth);
      const { count } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active");
      setActiveClients(count ?? 0);
    })().catch(() => setEstimate({}));
  }, [orgs, plans]);

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? "";
      const rows = [...subs]
        .sort((a, b) => b.due_date.localeCompare(a.due_date))
        .map((x) => ({
          Organización: orgName(x.organization_id),
          Plan: x.kind === "seats" ? `Cupos (${x.seats_count ?? 1} alumnos)` : x.plan_name ?? "",
          Monto: Number(x.amount),
          Moneda: x.currency,
          Vencimiento: x.due_date,
          Estado: STATUS_LABEL[effective(x, today)],
          "Pagado el": x.paid_at ? x.paid_at.slice(0, 10) : "",
          Método: x.method ?? "",
          Notas: x.notes ?? "",
        }));
      const resumen = [
        { Concepto: "Cobrado este mes", Monto: fmtMoney(paidThis) },
        { Concepto: "Cobrado el mes pasado", Monto: fmtMoney(paidLast) },
        { Concepto: "Por cobrar (no vencido)", Monto: fmtMoney(toCollect) },
        { Concepto: `Vencido (${overdueOrgs.size} organizaciones)`, Monto: fmtMoney(overdue) },
        { Concepto: "Ingreso mensual estimado", Monto: estimate ? fmtMoney(estimate) : "" },
        { Concepto: "Alumnos activos en la plataforma", Monto: String(activeClients ?? "") },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Cobros");
      XLSX.writeFile(wb, `FuerzaLab-cobros-${today}.xlsx`);
    } catch (e: any) {
      notify("No se pudo exportar: " + e.message);
    }
  };

  const Card = ({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) => (
    <div className="panel">
      <div className="bd">
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700, color: tone }}>{value}</div>
        <div className="note">{label}</div>
        {sub && <div className="note" style={{ fontSize: 12 }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Resumen</h3>
        <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={exportExcel}>Exportar a Excel</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <Card label="Cobrado este mes" value={fmtMoney(paidThis)} tone="var(--ok)" />
        <Card label="Cobrado el mes pasado" value={fmtMoney(paidLast)} />
        <Card label="Por cobrar" value={fmtMoney(toCollect)} sub="Pendiente que todavía no venció" />
        <Card label="Vencido" value={fmtMoney(overdue)} tone={overdueOrgs.size ? "var(--bad)" : undefined} sub={`${overdueOrgs.size} ${overdueOrgs.size === 1 ? "organización" : "organizaciones"}`} />
        <Card label="Ingreso mensual estimado" value={estimate ? fmtMoney(estimate) : "…"} sub="Con los planes y alumnos activos de hoy" />
        <Card label="Alumnos activos" value={activeClients == null ? "…" : String(activeClients)} sub="En toda la plataforma" />
      </div>
    </div>
  );
}

/** Todos los cobros de una organización, del más nuevo al más viejo. */
function SubsTable({ rows }: { rows: OrganizationSubscriptionRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const list = [...rows].sort((a, b) => b.due_date.localeCompare(a.due_date));
  if (!list.length) return <p className="note">Todavía no tiene cobros registrados.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
            <th style={{ padding: "8px 10px" }}>Vencimiento</th>
            <th style={{ padding: "8px 10px" }}>Plan</th>
            <th style={{ padding: "8px 10px" }}>Monto</th>
            <th style={{ padding: "8px 10px" }}>Estado</th>
            <th style={{ padding: "8px 10px" }}>Pagado el</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => {
            const st = effective(x, today);
            return (
              <tr key={x.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "8px 10px" }}>{new Date(x.due_date + "T12:00:00").toLocaleDateString("es")}</td>
                <td style={{ padding: "8px 10px" }}>{x.kind === "seats" ? `Cupos · ${x.seats_count ?? 1} ${x.seats_count === 1 ? "alumno" : "alumnos"}` : x.plan_name ?? "—"}</td>
                <td style={{ padding: "8px 10px" }}>{x.currency} {Number(x.amount).toLocaleString("es")}</td>
                <td style={{ padding: "8px 10px" }}><Chip tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Chip></td>
                <td style={{ padding: "8px 10px" }}>{x.paid_at ? new Date(x.paid_at).toLocaleDateString("es") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
