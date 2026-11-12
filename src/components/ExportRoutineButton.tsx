import { useState } from "react";
import { Download } from "lucide-react";
import Modal from "./ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { isAnyDemo } from "../lib/demo";
import { getOrgBrand } from "../services/brand";
import { exportRoutineExcel, exportRoutinePdf, type ExportScope } from "../services/routineExport";
import type { SessionRow } from "../services/sessions";

const WA = (import.meta.env.VITE_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");

/**
 * "Exportar" una rutina, la semana o todas las rutinas fijas, en PDF o Excel.
 * En las cuentas de demostración el botón se ve pero no exporta: invita a
 * crear la cuenta (así la demo no regala las rutinas).
 * `clientOnly`: en la app del alumno, solo PDF de la semana que está viendo.
 */
export default function ExportRoutineButton({
  session,
  fixedMode,
  clientOnly,
  label = "Exportar",
}: {
  session: SessionRow | null;
  fixedMode?: boolean;
  clientOnly?: boolean;
  label?: string;
}) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>(clientOnly ? (fixedMode ? "fixed" : "week") : "session");
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const demo = isAnyDemo(profile?.email);
  if (!session) return null;

  const run = async (kind: "pdf" | "xlsx") => {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        const brand = profile?.organization_id ? await getOrgBrand(profile.organization_id).catch(() => null) : null;
        await exportRoutinePdf(scope, session, { name: profile?.full_name ?? "", logoUrl: brand?.logoUrl ?? null });
      } else await exportRoutineExcel(scope, session);
      setOpen(false);
    } catch (e: any) {
      notify("No se pudo exportar: " + (e?.message ?? "error"));
    }
    setBusy(null);
  };

  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        <Download size={15} /> {label}
      </button>
      {open && (
        <Modal title={clientOnly ? "Descargar mi rutina" : "Exportar rutina"} onClose={() => setOpen(false)}>
          {demo ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0 }}>
                🔒 <b>Exportar rutinas está disponible en tu cuenta de FuerzaLab</b>, no en la demo: en PDF para imprimir o mandar por
                WhatsApp, y en Excel para editarlas o importarlas a otro alumno.
              </p>
              <p className="note" style={{ margin: 0 }}>¿Quieres probar FuerzaLab con tus alumnos? Escríbenos y te creamos tu cuenta.</p>
              {WA && (
                <a
                  className="btn"
                  style={{ justifySelf: "start" }}
                  href={`https://wa.me/${WA.startsWith("591") ? WA : "591" + WA}?text=${encodeURIComponent("¡Hola! Probé la demo de FuerzaLab y quiero usarla con mis alumnos.")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Escribir por WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {!clientOnly && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label className="export-opt">
                    <input type="radio" checked={scope === "session"} onChange={() => setScope("session")} /> Solo esta rutina ({session.name})
                  </label>
                  {fixedMode ? (
                    <label className="export-opt">
                      <input type="radio" checked={scope === "fixed"} onChange={() => setScope("fixed")} /> Todas las rutinas fijas
                    </label>
                  ) : (
                    <label className="export-opt">
                      <input type="radio" checked={scope === "week"} onChange={() => setScope("week")} /> Toda la semana
                    </label>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" disabled={!!busy} onClick={() => run("pdf")}>{busy === "pdf" ? "Generando…" : "Descargar PDF"}</button>
                {!clientOnly && (
                  <button className="btn ghost" disabled={!!busy} onClick={() => run("xlsx")}>{busy === "xlsx" ? "Generando…" : "Descargar Excel"}</button>
                )}
              </div>
              <p className="note" style={{ margin: 0, fontSize: 12.5 }}>
                {clientOnly
                  ? "Con tus ejercicios, series, repeticiones, carga y descanso, para tenerla a mano o imprimirla."
                  : "El PDF lleva tu logo, para imprimir o mandar por WhatsApp. El Excel tiene el formato de «Importar rutina»: lo puedes editar y volver a importar a otro alumno."}
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
