import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import WhatsAppButton from "./WhatsAppButton";
import { SUPPORT_WHATSAPP } from "../lib/beta";
import { getMyClientId } from "../services/clients";
import {
  fetchActivePlans,
  fetchPlatformSettings,
  fmtDate,
  listMyPayments,
  money,
  monthsLabel,
  platformFileUrl,
  studentPlanState,
  submitStudentPayment,
  type PlatformSettings,
  type StudentPayment,
  type StudentPlan,
} from "../services/studentBilling";

const STATUS_LABEL: Record<StudentPayment["status"], { text: string; cls: string }> = {
  pending: { text: "En revisión", cls: "warn" },
  approved: { text: "Confirmado", cls: "ok" },
  rejected: { text: "Rechazado", cls: "bad" },
};

/**
 * "Mi plan FuerzaLab" del alumno: hasta cuándo tiene la app, los planes,
 * el QR para pagar y el envío del comprobante (part4q). Se usa en su página
 * y en la pantalla de acceso pausado.
 */
export default function StudentPlanPanel() {
  const { orgBilling, refreshProfile } = useAuth();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [plans, setPlans] = useState<StudentPlan[] | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [planId, setPlanId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const state = studentPlanState(orgBilling);
  const pending = payments.some((p) => p.status === "pending") || !!orgBilling?.student_pending_payment;

  const load = async () => {
    try {
      const [id, ps, st] = await Promise.all([getMyClientId(), fetchActivePlans(), fetchPlatformSettings()]);
      setClientId(id);
      setPlans(ps);
      setSettings(st);
      if (ps.length && !planId) setPlanId(ps[0].id);
      if (st?.qr_path) platformFileUrl(st.qr_path, 3600).then(setQrUrl).catch(() => setQrUrl(null));
      if (id) setPayments(await listMyPayments(id));
    } catch (e: any) {
      setError(e.message ?? "No pudimos cargar tu plan.");
      setPlans([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  const send = async () => {
    if (!clientId || !plan) return;
    if (!file) {
      setError("Adjunta la foto o captura del comprobante.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await submitStudentPayment(clientId, plan.id, file);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      notify("¡Listo! Recibimos tu comprobante. Te avisamos apenas lo confirmemos.");
      setPayments(await listMyPayments(clientId));
      await refreshProfile();
    } catch (e: any) {
      setError(e.message ?? "No se pudo enviar el comprobante.");
    }
    setBusy(false);
  };

  const statusBox = () => {
    switch (state.kind) {
      case "exempt":
        return { tone: "ok", title: "Tu cuenta no tiene cobro", text: "Puedes usar FuerzaLab sin pagar ningún plan." };
      case "ok":
        return { tone: "ok", title: `Tu plan está activo hasta el ${fmtDate(state.until)}`, text: `Te quedan ${state.daysLeft} días.` };
      case "soon":
        return {
          tone: "warn",
          title: state.daysLeft === 0 ? "Tu plan vence hoy" : `Tu plan vence el ${fmtDate(state.until)}`,
          text: state.daysLeft === 0 ? "Paga tu próximo período para seguir usando la app." : `Te ${state.daysLeft === 1 ? "queda 1 día" : `quedan ${state.daysLeft} días`}. Si pagas ahora, el nuevo período empieza cuando termina el actual: no pierdes ningún día.`,
        };
      case "grace":
        return {
          tone: "bad",
          title: `Tu plan venció el ${fmtDate(state.until)}`,
          text: `Tienes ${state.graceLeft === 0 ? "hasta hoy" : state.graceLeft === 1 ? "1 día más" : `${state.graceLeft} días más`} para pagar antes de que se pause tu acceso a la app.`,
        };
      case "blocked":
        return {
          tone: "bad",
          title: "Tu acceso a la app está pausado",
          text: `Tu plan venció el ${fmtDate(state.until)}. No se perdió nada: apenas confirmemos tu pago, vuelves a ver tu rutina y todo tu historial. Tu entrenador sigue teniendo tu información para entrenarte de forma segura.`,
        };
      default:
        return null;
    }
  };
  const box = statusBox();
  const toneColor = (t: string) => (t === "ok" ? "var(--ok)" : t === "warn" ? "#E3A21A" : "var(--bad)");

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
      {box && (
        <div className="panel" style={{ borderLeft: `4px solid ${toneColor(box.tone)}` }}>
          <div className="bd">
            <b style={{ fontSize: 16 }}>{box.title}</b>
            <p className="note" style={{ margin: "4px 0 0" }}>{box.text}</p>
          </div>
        </div>
      )}

      {pending && (
        <div className="panel" style={{ borderLeft: "4px solid var(--pri)" }}>
          <div className="bd">
            <b>Tu comprobante está en revisión</b>
            <p className="note" style={{ margin: "4px 0 0" }}>Lo revisamos en menos de un día hábil. Apenas lo confirmemos, se actualiza tu plan solo.</p>
          </div>
        </div>
      )}

      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

      {state.kind !== "exempt" && !pending && plans && (
        <div className="panel">
          <div className="hd"><h3>Pagar mi plan</h3></div>
          <div className="bd" style={{ display: "grid", gap: 16 }}>
            <p className="note" style={{ margin: 0 }}>
              El pago es a <b>FuerzaLab</b>, la app que usa tu entrenador, y es aparte de lo que le pagas a él por el entrenamiento.
            </p>

            {plans.length === 0 ? (
              <p style={{ margin: 0 }}>Todavía no hay planes disponibles. Escríbenos y te ayudamos.</p>
            ) : (
              <>
                <div>
                  <div className="field-label">1. Elige tu plan</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
                    {plans.map((p) => {
                      const sel = p.id === planId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlanId(p.id)}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: sel ? "2px solid var(--pri)" : "1px solid var(--line)",
                            background: sel ? "var(--pri-soft)" : "#fff",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          <b style={{ display: "block" }}>{p.name}</b>
                          <span style={{ fontSize: 18, fontWeight: 700 }}>{money(p.price, p.currency)}</span>
                          <span className="note" style={{ display: "block", fontSize: 12 }}>
                            {monthsLabel(p.months)}
                            {p.months > 1 ? ` · ${money(Math.round((p.price / p.months) * 100) / 100, p.currency)} por mes` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="field-label">2. Paga con el QR desde la app de tu banco</div>
                  {qrUrl ? (
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <img src={qrUrl} alt="QR para pagar a FuerzaLab" style={{ width: 200, height: 200, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }} />
                      <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        {plan && (
                          <span>
                            Monto a pagar: <b style={{ fontSize: 17 }}>{money(plan.price, plan.currency)}</b>
                          </span>
                        )}
                        <span className="note">
                          A nombre de: <b>{settings?.account_holder}</b>
                          {settings?.bank_name ? ` · ${settings.bank_name}` : ""}
                        </span>
                        <span className="note">Si el QR te pide el monto, escribe exactamente el de tu plan.</span>
                        <a className="link-btn" href={qrUrl} target="_blank" rel="noreferrer" download>Descargar el QR</a>
                      </div>
                    </div>
                  ) : (
                    <p className="note" style={{ margin: 0 }}>El QR todavía no está disponible. Escríbenos por WhatsApp y te lo enviamos.</p>
                  )}
                </div>

                <div>
                  <div className="field-label">3. Sube la foto o captura del comprobante</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="input"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <button className="btn" onClick={send} disabled={busy || !plan || !file || !clientId}>
                  {busy ? "Enviando…" : "Enviar comprobante"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="panel">
          <div className="hd"><h3>Mis pagos</h3></div>
          <div className="bd" style={{ display: "grid", gap: 10 }}>
            {payments.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span>
                  <b>{p.plan_name}</b> <span className="note">· {money(p.amount, p.currency)} · enviado el {fmtDate(p.created_at)}</span>
                  {p.status === "approved" && p.period_start && p.period_end && (
                    <div className="note" style={{ fontSize: 12.5 }}>Del {fmtDate(p.period_start)} al {fmtDate(p.period_end)}</div>
                  )}
                  {p.status === "rejected" && p.note && <div style={{ fontSize: 12.5, color: "var(--bad)" }}>Motivo: {p.note}</div>}
                </span>
                <span className={`chip ${STATUS_LABEL[p.status].cls}`}>{STATUS_LABEL[p.status].text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <WhatsAppButton phone={SUPPORT_WHATSAPP} small label="Consultas sobre mi plan" text="Hola, te escribo por mi plan de FuerzaLab. " />
      </div>
    </div>
  );
}
