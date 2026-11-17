import { useEffect, useMemo, useRef, useState } from "react";
import Loading from "../../components/ui/Loading";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import {
  addManualPayment,
  clientPlanState,
  deletePlan,
  fetchAllPlans,
  fetchPlatformSettings,
  fetchStudentsBilling,
  fmtDate,
  listClientPayments,
  listPendingPayments,
  money,
  monthsLabel,
  platformFileUrl,
  reviewPayment,
  savePlan,
  savePlatformSettings,
  setStudentAccess,
  startStudentBilling,
  pauseStudentBilling,
  uploadQr,
  type PlatformSettings,
  type StudentBillingRow,
  type StudentPayment,
  type StudentPlan,
} from "../../services/studentBilling";

type Tab = "review" | "students" | "setup";
type Filter = "all" | "soon" | "grace" | "blocked" | "exempt";

const STATE_CHIP: Record<string, { text: string; cls: string }> = {
  ok: { text: "Al día", cls: "ok" },
  soon: { text: "Por vencer", cls: "warn" },
  grace: { text: "Vencido (en gracia)", cls: "bad" },
  blocked: { text: "App pausada", cls: "bad" },
  exempt: { text: "Sin cobro", cls: "pri" },
  none: { text: "—", cls: "" },
};

/**
 * Super Admin → Pagos de alumnos (part4q): comprobantes por confirmar,
 * estado del plan de cada alumno, y los planes, precios y QR.
 */
export default function StudentBillingPage() {
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("review");
  const [rows, setRows] = useState<StudentBillingRow[] | null>(null);
  const [pending, setPending] = useState<StudentPayment[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [r, p, s] = await Promise.all([fetchStudentsBilling(), listPendingPayments(), fetchPlatformSettings()]);
      setRows(r);
      setPending(p);
      setSettings(s);
      setError("");
    } catch (e: any) {
      setError(e.message ?? "No se pudo cargar.");
      setRows([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const byClient = useMemo(() => new Map((rows ?? []).map((r) => [r.client_id, r])), [rows]);
  const grace = settings?.grace_days ?? 7;
  const reminder = settings?.reminder_days ?? 5;

  const tabs: { id: Tab; label: string }[] = [
    { id: "review", label: `Por confirmar${pending.length ? ` (${pending.length})` : ""}` },
    { id: "students", label: "Alumnos" },
    { id: "setup", label: "Planes, precios y QR" },
  ];

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Pagos de alumnos</h1>
      <p className="note" style={{ marginBottom: 18, maxWidth: 760 }}>
        Cada alumno le paga a FuerzaLab su plan por QR y sube el comprobante. Al confirmarlo, su plan se extiende desde el día
        en que vence el actual (o desde hoy, si ya venció). {grace} días después del vencimiento sin pagar, se pausa su acceso
        a la app; su entrenador nunca pierde el acceso a sus datos.
      </p>
      {settings && settings.student_billing_enabled === false && (
        <div className="billing-banner warn" style={{ marginBottom: 10 }}>
          <b>Cobro a alumnos: pausado.</b> Nadie recibe avisos de pago ni se le pausa la app. Las fechas de abajo son las que
          se aplicarían. Para empezar a cobrar, ve a «Planes, precios y QR».
        </div>
      )}
      {settings?.beta_mode && (
        <div className="billing-banner warn" style={{ marginBottom: 16 }}>
          Etapa de prueba activa: los alumnos que se registran tienen la app gratis hasta que termina la prueba de su
          entrenador. Al apagarla (en «Planes, precios y QR»), cada alumno nuevo recibe {settings.free_days} días gratis desde su registro.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="btn ghost"
            onClick={() => setTab(t.id)}
            style={{ borderColor: tab === t.id ? "var(--pri)" : "var(--line)", background: tab === t.id ? "var(--pri-soft)" : "#fff", fontWeight: tab === t.id ? 700 : 500 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!rows && <Loading />}

      {rows && tab === "review" && (
        <ReviewList
          pending={pending}
          byClient={byClient}
          onDone={async () => {
            await load();
          }}
          notify={notify}
        />
      )}
      {rows && tab === "students" && <StudentsList rows={rows} grace={grace} reminder={reminder} onChanged={load} notify={notify} />}
      {rows && tab === "setup" && settings && <Setup settings={settings} onSaved={load} notify={notify} />}
    </div>
  );
}

// --- Comprobantes por confirmar ------------------------------------------------

function ReviewList({
  pending,
  byClient,
  onDone,
  notify,
}: {
  pending: StudentPayment[];
  byClient: Map<string, StudentBillingRow>;
  onDone: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<StudentPayment | null>(null);
  const [reason, setReason] = useState("");

  const openReceipt = async (path: string) => {
    const w = window.open("", "_blank");
    try {
      const url = await platformFileUrl(path);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      w?.close();
      notify(e.message ?? "No se pudo abrir el comprobante.");
    }
  };

  const approve = async (p: StudentPayment) => {
    setBusy(p.id);
    try {
      const r = await reviewPayment(p.id, true);
      notify(`Pago confirmado: plan hasta el ${fmtDate(r.period_end!)}.`);
      await onDone();
    } catch (e: any) {
      notify(e.message);
    }
    setBusy(null);
  };

  if (pending.length === 0) return <p className="note">No hay comprobantes por confirmar. 👍</p>;

  return (
    <>
      <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
        {pending.map((p) => {
          const c = byClient.get(p.client_id);
          return (
            <div key={p.id} className="panel">
              <div className="bd" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span>
                  <b>{c?.client_name ?? "Alumno"}</b> <span className="note">· {c?.organization_name ?? ""}</span>
                  <div style={{ fontSize: 14 }}>
                    {p.plan_name} ({monthsLabel(p.months ?? 1)}) · <b>{money(p.amount, p.currency)}</b>
                  </div>
                  <div className="note" style={{ fontSize: 12.5 }}>
                    Enviado el {fmtDate(p.created_at)}
                    {c?.access_until ? ` · su plan vence/venció el ${fmtDate(c.access_until)}` : ""}
                  </div>
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.receipt_path && (
                    <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => openReceipt(p.receipt_path!)}>
                      Ver comprobante
                    </button>
                  )}
                  <button className="btn" style={{ padding: "5px 12px", fontSize: 13 }} disabled={busy === p.id} onClick={() => approve(p)}>
                    {busy === p.id ? "Confirmando…" : "Confirmar"}
                  </button>
                  <button
                    className="btn ghost"
                    style={{ padding: "5px 10px", fontSize: 13, color: "var(--bad)" }}
                    disabled={busy === p.id}
                    onClick={() => {
                      setReason("");
                      setRejecting(p);
                    }}
                  >
                    Rechazar
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {rejecting && (
        <Modal title="Rechazar comprobante" onClose={() => setRejecting(null)}>
          <label className="field-label">Motivo (lo ve el alumno)</label>
          <input className="input" style={{ marginBottom: 14 }} value={reason} placeholder="Ej. No se ve el monto; el monto no coincide con el plan" onChange={(e) => setReason(e.target.value)} autoFocus />
          <button
            className="btn"
            disabled={busy === rejecting.id}
            onClick={async () => {
              setBusy(rejecting.id);
              try {
                await reviewPayment(rejecting.id, false, reason);
                notify("Comprobante rechazado. El alumno puede enviar otro.");
                setRejecting(null);
                await onDone();
              } catch (e: any) {
                notify(e.message);
              }
              setBusy(null);
            }}
          >
            Rechazar
          </button>
        </Modal>
      )}
    </>
  );
}

// --- Alumnos ------------------------------------------------------------------

function StudentsList({
  rows,
  grace,
  reminder,
  onChanged,
  notify,
}: {
  rows: StudentBillingRow[];
  grace: number;
  reminder: number;
  onChanged: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<StudentBillingRow | null>(null);
  const withState = rows.map((r) => ({ r, s: clientPlanState(r.access_until, r.exempt, grace, reminder) }));
  const counts = {
    soon: withState.filter((x) => x.s.kind === "soon").length,
    grace: withState.filter((x) => x.s.kind === "grace").length,
    blocked: withState.filter((x) => x.s.kind === "blocked").length,
    exempt: withState.filter((x) => x.s.kind === "exempt").length,
  };
  const list = withState
    .filter((x) => filter === "all" || x.s.kind === filter)
    .filter((x) => !q.trim() || `${x.r.client_name} ${x.r.organization_name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `Todos (${rows.length})` },
    { id: "soon", label: `Por vencer (${counts.soon})` },
    { id: "grace", label: `Vencidos en gracia (${counts.grace})` },
    { id: "blocked", label: `App pausada (${counts.blocked})` },
    { id: "exempt", label: `Sin cobro (${counts.exempt})` },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {filters.map((f) => (
          <button key={f.id} type="button" className={`chip ${filter === f.id ? "pri" : ""}`} style={{ border: 0, cursor: "pointer", padding: "5px 11px" }} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <input className="input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder="Buscar alumno o estudio" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <p className="note">No hay alumnos en esta lista.</p>}
      <div className="panel" style={{ maxWidth: 900 }}>
        <div className="bd" style={{ display: "grid", gap: 0, padding: 0 }}>
          {list.map(({ r, s }) => (
            <div key={r.client_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
              <span>
                <b>{r.client_name}</b> <span className="note">· {r.organization_name}</span>
                <div className="note" style={{ fontSize: 12.5 }}>
                  {r.access_until && !r.exempt ? `Plan hasta el ${fmtDate(r.access_until)}` : r.exempt ? "Sin cobro" : "Sin fecha"}
                  {r.last_plan ? ` · último pago: ${r.last_plan}` : " · todavía no pagó"}
                  {r.pending_payments > 0 ? " · tiene un comprobante por confirmar" : ""}
                </div>
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={`chip ${STATE_CHIP[s.kind].cls}`}>{STATE_CHIP[s.kind].text}</span>
                <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditing(r)}>
                  Gestionar
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <ManageStudentModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
          notify={notify}
        />
      )}
    </>
  );
}

function ManageStudentModal({ row, onClose, onSaved, notify }: { row: StudentBillingRow; onClose: () => void; onSaved: () => Promise<void>; notify: (m: string) => void }) {
  const [until, setUntil] = useState(row.access_until ?? "");
  const [exempt, setExempt] = useState(row.exempt);
  const [plans, setPlans] = useState<StudentPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<StudentPayment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAllPlans().then((p) => {
      setPlans(p);
      if (p[0]) {
        setPlanId(p[0].id);
        setAmount(String(p[0].price));
      }
    });
    listClientPayments(row.client_id).then(setHistory).catch(() => {});
  }, [row.client_id]);

  return (
    <Modal title={row.client_name} onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>{row.organization_name}{row.trainer_name ? ` · entrenador: ${row.trainer_name}` : ""}</p>

      <h3 style={{ margin: "8px 0" }}>Registrar un pago a mano</h3>
      <p className="note" style={{ marginTop: 0 }}>Por ejemplo, si te pagó en efectivo. Se confirma de una vez y extiende su plan.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <select
          className="input"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            const p = plans.find((x) => x.id === e.target.value);
            if (p) setAmount(String(p.price));
          }}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({monthsLabel(p.months)})</option>
          ))}
        </select>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" />
      </div>
      <input className="input" style={{ marginBottom: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional), ej. efectivo" />
      <button
        className="btn"
        style={{ marginBottom: 18 }}
        disabled={busy || !planId}
        onClick={async () => {
          setBusy(true);
          try {
            const n = Number(amount.replace(",", "."));
            const r = await addManualPayment(row.client_id, planId, Number.isFinite(n) ? n : null, note);
            notify(`Pago registrado: plan hasta el ${fmtDate(r.period_end!)}.`);
            await onSaved();
          } catch (e: any) {
            notify(e.message);
          }
          setBusy(false);
        }}
      >
        Registrar pago
      </button>

      <h3 style={{ margin: "8px 0" }}>Ajustar a mano</h3>
      <label className="field-label">Tiene la app hasta el</label>
      <input type="date" className="input" style={{ marginBottom: 8, maxWidth: 220 }} value={until} onChange={(e) => setUntil(e.target.value)} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginBottom: 12 }}>
        <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} /> Sin cobro (no paga plan, nunca se le pausa la app)
      </label>
      <button
        className="btn ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await setStudentAccess(row.client_id, until || null, exempt);
            notify("Guardado.");
            await onSaved();
          } catch (e: any) {
            notify(e.message);
          }
          setBusy(false);
        }}
      >
        Guardar ajuste
      </button>

      {history.length > 0 && (
        <>
          <h3 style={{ margin: "18px 0 8px" }}>Pagos</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {history.map((p) => (
              <div key={p.id} className="note" style={{ fontSize: 13 }}>
                {fmtDate(p.created_at)} · {p.plan_name} · {money(p.amount, p.currency)} ·{" "}
                {p.status === "approved" ? `confirmado (${p.period_start ? fmtDate(p.period_start) : ""} → ${p.period_end ? fmtDate(p.period_end) : ""})` : p.status === "pending" ? "por confirmar" : `rechazado${p.note ? `: ${p.note}` : ""}`}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// --- Planes, precios y QR -----------------------------------------------------

function Setup({ settings, onSaved, notify }: { settings: PlatformSettings; onSaved: () => Promise<void>; notify: (m: string) => void }) {
  const [plans, setPlans] = useState<StudentPlan[] | null>(null);
  const [s, setS] = useState(settings);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPlans = () => fetchAllPlans().then(setPlans).catch((e) => notify(e.message));
  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (s.qr_path) platformFileUrl(s.qr_path).then(setQrUrl).catch(() => setQrUrl(null));
    else setQrUrl(null);
  }, [s.qr_path]);

  const qrDays = s.qr_expires_on ? Math.round((new Date(s.qr_expires_on + "T00:00:00").getTime() - Date.now()) / 86400000) : null;

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
      <BillingSwitch settings={s} hasQr={!!s.qr_path} hasPlans={!!plans?.some((p) => p.active && p.price > 0)} onChanged={onSaved} notify={notify} />

      <div className="panel">
        <div className="hd"><h3>Planes del alumno</h3></div>
        <div className="bd" style={{ display: "grid", gap: 10 }}>
          <p className="note" style={{ margin: 0 }}>Solo los planes activos (y con precio) le aparecen al alumno. Los cambios de precio valen para los pagos nuevos.</p>
          {!plans && <Loading />}
          {plans?.map((p) => (
            <PlanRow key={p.id} plan={p} onSaved={loadPlans} notify={notify} />
          ))}
          <button
            className="btn ghost"
            style={{ justifySelf: "start" }}
            onClick={async () => {
              try {
                await savePlan({ name: "Nuevo plan", months: 1, price: 0, active: false, sort: (plans?.length ?? 0) + 1 });
                loadPlans();
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            + Agregar plan
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="hd"><h3>QR para pagar</h3></div>
        <div className="bd" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {qrUrl ? (
              <img src={qrUrl} alt="QR" style={{ width: 160, height: 160, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 10 }} />
            ) : (
              <div className="note" style={{ width: 160, height: 160, display: "grid", placeItems: "center", border: "1px dashed var(--line)", borderRadius: 10, textAlign: "center", padding: 10 }}>
                Todavía no subiste el QR
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    const path = await uploadQr(f, s.qr_path);
                    setS({ ...s, qr_path: path });
                    notify("QR actualizado.");
                  } catch (er: any) {
                    notify(er.message);
                  }
                  setBusy(false);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <button className="btn" style={{ justifySelf: "start" }} disabled={busy} onClick={() => fileRef.current?.click()}>
                {s.qr_path ? "Cambiar el QR" : "Subir el QR"}
              </button>
              <span className="note" style={{ fontSize: 12.5 }}>Conviene un QR sin monto fijo: el alumno escribe el monto de su plan.</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
            <div>
              <label className="field-label">El QR vence el</label>
              <input type="date" className="input" value={s.qr_expires_on ?? ""} onChange={(e) => setS({ ...s, qr_expires_on: e.target.value || null })} />
              {qrDays != null && qrDays <= 15 && (
                <span style={{ fontSize: 12.5, color: "var(--bad)" }}>{qrDays < 0 ? "¡Ya venció! Genera uno nuevo." : `Vence en ${qrDays} días: genera uno nuevo.`}</span>
              )}
            </div>
            <div>
              <label className="field-label">A nombre de</label>
              <input className="input" value={s.account_holder} onChange={(e) => setS({ ...s, account_holder: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Banco (opcional)</label>
              <input className="input" value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd"><h3>Reglas</h3></div>
        <div className="bd" style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
            <input type="checkbox" checked={s.beta_mode} onChange={(e) => setS({ ...s, beta_mode: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <b>Etapa de prueba</b>
              <span className="note" style={{ display: "block" }}>
                Prendida: el alumno que se registra tiene la app gratis hasta que termina la prueba de su entrenador. Apagada: cada
                alumno nuevo tiene los días gratis de abajo, desde su registro. No cambia a los alumnos que ya están registrados.
              </span>
            </span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <NumField label="Días gratis (después de la prueba)" value={s.free_days} onChange={(v) => setS({ ...s, free_days: v })} />
            <NumField label="Aviso antes de vencer (días)" value={s.reminder_days} onChange={(v) => setS({ ...s, reminder_days: v })} />
            <NumField label="Días de gracia antes de pausar" value={s.grace_days} onChange={(v) => setS({ ...s, grace_days: v })} />
          </div>
        </div>
      </div>

      <button
        className="btn"
        style={{ justifySelf: "start" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await savePlatformSettings({
              beta_mode: s.beta_mode,
              free_days: s.free_days,
              grace_days: s.grace_days,
              reminder_days: s.reminder_days,
              qr_expires_on: s.qr_expires_on,
              account_holder: s.account_holder.trim() || "Mario Ernesto Rodas Arce",
              bank_name: s.bank_name?.trim() || null,
            });
            notify("Guardado.");
            await onSaved();
          } catch (e: any) {
            notify(e.message);
          }
          setBusy(false);
        }}
      >
        Guardar QR y reglas
      </button>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="input" type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
    </div>
  );
}

function PlanRow({ plan, onSaved, notify }: { plan: StudentPlan; onSaved: () => void; notify: (m: string) => void }) {
  const [p, setP] = useState(plan);
  const [price, setPrice] = useState(String(plan.price));
  const dirty = p.name !== plan.name || p.months !== plan.months || p.active !== plan.active || Number(price.replace(",", ".")) !== Number(plan.price);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <input className="input" style={{ flex: "1 1 140px" }} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} aria-label="Nombre del plan" />
      <label className="note" style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input className="input" type="number" min={1} style={{ width: 70 }} value={p.months} onChange={(e) => setP({ ...p, months: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /> meses
      </label>
      <label className="note" style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {p.currency} <input className="input" inputMode="decimal" style={{ width: 90 }} value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
        <input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Activo
      </label>
      <button
        className="btn"
        style={{ padding: "5px 12px", fontSize: 13 }}
        disabled={!dirty}
        onClick={async () => {
          const n = Number(price.replace(",", "."));
          if (!Number.isFinite(n) || n < 0) return notify("Escribe un precio válido.");
          if (p.active && n <= 0) return notify("Para activar el plan, ponle un precio mayor a 0.");
          try {
            await savePlan({ id: p.id, name: p.name.trim() || plan.name, months: p.months, price: n, active: p.active });
            notify("Plan guardado.");
            onSaved();
          } catch (e: any) {
            notify(e.message);
          }
        }}
      >
        Guardar
      </button>
      <button
        className="btn ghost"
        style={{ padding: "5px 10px", fontSize: 13, color: "var(--bad)" }}
        onClick={async () => {
          if (!confirm(`¿Eliminar el plan «${plan.name}»? Los pagos ya hechos con este plan se conservan.`)) return;
          try {
            await deletePlan(plan.id);
            onSaved();
          } catch (e: any) {
            notify(e.message);
          }
        }}
      >
        Eliminar
      </button>
    </div>
  );
}

// --- Interruptor del cobro a alumnos (part4t) -------------------------------

function BillingSwitch({
  settings,
  hasQr,
  hasPlans,
  onChanged,
  notify,
}: {
  settings: PlatformSettings;
  hasQr: boolean;
  hasPlans: boolean;
  onChanged: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const on = settings.student_billing_enabled !== false;
  const [days, setDays] = useState(15);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = [!hasPlans && "al menos un plan activo con precio", !hasQr && "el QR"].filter(Boolean) as string[];

  return (
    <div className="panel" style={{ borderLeft: `4px solid ${on ? "var(--ok)" : "#E3A21A"}` }}>
      <div className="hd"><h3>Cobro a alumnos: {on ? "activo" : "pausado"}</h3></div>
      <div className="bd" style={{ display: "grid", gap: 10 }}>
        {on ? (
          <>
            <p className="note" style={{ margin: 0 }}>
              Los alumnos reciben el aviso {settings.reminder_days} días antes de vencer y, {settings.grace_days} días después del
              vencimiento sin pagar, se les pausa la app.
            </p>
            <button
              className="btn ghost"
              style={{ justifySelf: "start" }}
              disabled={busy}
              onClick={async () => {
                if (!confirm("¿Pausar el cobro a alumnos? Nadie va a recibir avisos de pago ni se le va a pausar la app.")) return;
                setBusy(true);
                try {
                  await pauseStudentBilling();
                  notify("Cobro a alumnos pausado.");
                  await onChanged();
                } catch (e: any) {
                  notify(e.message);
                }
                setBusy(false);
              }}
            >
              Pausar el cobro
            </button>
          </>
        ) : (
          <>
            <p className="note" style={{ margin: 0 }}>
              Etapa de prueba: nadie paga, nadie recibe avisos de pago y a nadie se le pausa la app. Cuando empieces a cobrar,
              cada alumno (salvo los «sin cobro») tendrá al menos los días que elijas para pagar, desde ese día. Los Términos piden
              avisar con al menos 15 días.
            </p>
            {missing.length > 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--bad)" }}>Para empezar a cobrar, primero carga {missing.join(" y ")} (más abajo).</p>
            ) : !confirming ? (
              <button className="btn" style={{ justifySelf: "start" }} onClick={() => setConfirming(true)}>
                Empezar a cobrar
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label className="note" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  Días para pagar desde hoy
                  <input className="input" type="number" min={0} style={{ width: 80 }} value={days} onChange={(e) => setDays(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                </label>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const n = await startStudentBilling(days);
                      notify(`Cobro activado. ${n} ${n === 1 ? "alumno tiene" : "alumnos tienen"} al menos ${days} días para pagar.`);
                      setConfirming(false);
                      await onChanged();
                    } catch (e: any) {
                      notify(e.message);
                    }
                    setBusy(false);
                  }}
                >
                  {busy ? "Activando…" : "Confirmar y empezar"}
                </button>
                <button className="btn ghost" onClick={() => setConfirming(false)}>Cancelar</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
