import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { getMyClientId } from "../../services/clients";
import { listPayments, uploadReceipt, getReceiptUrl, type PaymentRow, type PaymentStatus } from "../../services/payments";
import Loading from "../../components/ui/Loading";

const STATUS_LABEL: Record<PaymentStatus, string> = { pending: "Pendiente", paid: "Pagado", cancelled: "Cancelado" };
const STATUS_TONE: Record<PaymentStatus, "warn" | "ok" | "bad"> = { pending: "warn", paid: "ok", cancelled: "bad" };

export default function ClientPayments() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const id = await getMyClientId();
      setClientId(id);
      if (id) setPayments(await listPayments(id));
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadingFor || !clientId || !profile?.organization_id) return;
    try {
      await uploadReceipt({ paymentId: uploadingFor, organizationId: profile.organization_id, clientId, file });
      notify("Comprobante subido.");
      await load();
    } catch (err: any) {
      notify(err.message);
    }
    setUploadingFor(null);
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Pagos</h1>
      <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} aria-label="Subir comprobante" />
      {loading ? (
        <Loading />
      ) : (
        <div className="panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "10px 16px" }}>Plan</th>
                  <th style={{ padding: "10px 16px" }}>Monto</th>
                  <th style={{ padding: "10px 16px" }}>Vencimiento</th>
                  <th style={{ padding: "10px 16px" }}>Fecha de pago</th>
                  <th style={{ padding: "10px 16px" }}>Estado</th>
                  <th style={{ padding: "10px 16px" }}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "11px 16px" }}>{p.plan_name ?? <span className="note">Sin plan</span>}</td>
                    <td style={{ padding: "11px 16px" }}>{p.currency} {p.amount.toLocaleString("es")}</td>
                    <td style={{ padding: "11px 16px" }}>{new Date(p.due_date).toLocaleDateString("es")}</td>
                    <td style={{ padding: "11px 16px" }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString("es") : <span className="note">—</span>}</td>
                    <td style={{ padding: "11px 16px" }}><Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip></td>
                    <td style={{ padding: "11px 16px" }}>
                      {p.receipt_path ? (
                        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={async () => window.open(await getReceiptUrl(p.receipt_path!), "_blank")}>
                          Ver comprobante
                        </button>
                      ) : p.status === "pending" ? (
                        <button
                          className="btn ghost"
                          style={{ padding: "4px 10px", fontSize: 12.5 }}
                          onClick={() => {
                            setUploadingFor(p.id);
                            fileRef.current?.click();
                          }}
                        >
                          Subir comprobante
                        </button>
                      ) : (
                        <span className="note">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="note" style={{ padding: 16 }}>Todavía no hay pagos registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
