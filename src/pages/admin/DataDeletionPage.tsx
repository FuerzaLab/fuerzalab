import { useEffect, useState } from "react";
import Loading from "../../components/ui/Loading";
import ConfirmModal from "../../components/ui/ConfirmModal";
import WhatsAppButton from "../../components/WhatsAppButton";
import { useToast } from "../../contexts/ToastContext";
import { deleteCandidate, fetchDeletionCandidates, REASON_LABEL, type DeletionCandidate } from "../../services/adminDeletion";

const fmt = (d: string | null) => (d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "—");
const first = (s: string) => s.trim().split(/\s+/)[0] || s;

/**
 * Super Admin → Datos por borrar: alumnos que ya cumplieron un plazo de
 * borrado de los Términos y la Privacidad (part4u). Tú decides cada caso.
 */
export default function DataDeletionPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<DeletionCandidate[] | null>(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<DeletionCandidate | null>(null);

  const load = () =>
    fetchDeletionCandidates()
      .then((r) => {
        setRows(r);
        setError("");
      })
      .catch((e) => {
        setError(e.message);
        setRows([]);
      });
  useEffect(() => {
    load();
  }, []);

  const notice = (c: DeletionCandidate) =>
    c.reason === "suspended"
      ? `Hola ${first(c.client_name)}, te escribo de FuerzaLab. Tu plan está suspendido por falta de pago hace más de 6 meses. Como dicen nuestros Términos, si no lo renuevas en los próximos 7 días vamos a borrar tus datos (entrenamientos, evaluaciones y fotos). Si quieres conservarlos, entra a la app y paga tu plan. ¡Gracias!`
      : c.reason === "trial_ended"
        ? `Hola ${first(c.client_name)}, te escribo de FuerzaLab. Terminó tu etapa de prueba y no continuaste, así que, como dicen nuestros Términos, vamos a borrar tus datos. Si quieres seguir usando la app, entra y elige tu plan. ¡Gracias!`
        : `Hola ${first(c.client_name)}, te escribo de FuerzaLab. Pasaron más de 12 meses desde tu baja, así que vamos a borrar tus datos, como dice nuestra Política de privacidad. ¡Gracias por haber entrenado con nosotros!`;

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Datos por borrar</h1>
      <p className="note" style={{ marginBottom: 18, maxWidth: 760 }}>
        Alumnos que ya cumplieron un plazo de borrado de los Términos y la Política de privacidad. Avísales por WhatsApp
        (obligatorio en los suspendidos: «previo aviso») y, cuando corresponda, borra sus datos. El borrado elimina su ficha,
        entrenamientos, evaluaciones, fotos, comprobantes, mensajes y su cuenta. No se puede deshacer.
      </p>
      {!rows && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {rows && !error && rows.length === 0 && <p className="note">No hay datos por borrar. 👍</p>}
      <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
        {rows?.map((c) => (
          <div key={c.client_id} className="panel">
            <div className="bd" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span>
                <b>{c.client_name}</b> <span className="note">· {c.organization_name}{c.trainer_name ? ` · ${c.trainer_name}` : ""}</span>
                <div style={{ fontSize: 14 }}>{REASON_LABEL[c.reason].title} <span className="note">(desde el {fmt(c.since)})</span></div>
                <div className="note" style={{ fontSize: 12.5 }}>{REASON_LABEL[c.reason].rule}</div>
              </span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.client_phone && <WhatsAppButton small phone={c.client_phone} label="Avisarle" text={notice(c)} />}
                <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, color: "var(--bad)" }} onClick={() => setTarget(c)}>
                  Borrar sus datos
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
      {target && (
        <ConfirmModal
          title="Borrar todos sus datos"
          message={`¿Borrar para siempre a ${target.client_name}? Se eliminan su ficha, entrenamientos, evaluaciones, fotos, comprobantes, mensajes y su cuenta. No se puede deshacer.`}
          confirmLabel="Borrar para siempre"
          danger
          onClose={() => setTarget(null)}
          onConfirm={async () => {
            try {
              await deleteCandidate(target);
              notify(`Se borraron los datos de ${target.client_name}.`);
              setTarget(null);
              await load();
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
    </div>
  );
}
