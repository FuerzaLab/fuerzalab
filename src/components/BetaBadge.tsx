import { useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./ui/Modal";
import WhatsAppButton from "./WhatsAppButton";
import { IS_BETA, SUPPORT_WHATSAPP } from "../lib/beta";

/** Etiqueta "BETA" junto al logo. Al tocarla, explica qué significa y ofrece avisar por WhatsApp. */
export default function BetaBadge() {
  const [open, setOpen] = useState(false);
  if (!IS_BETA) return null;
  return (
    <>
      <button
        type="button"
        className="beta-badge"
        title="FuerzaLab está en versión beta"
        aria-label="FuerzaLab está en versión beta: ver qué significa"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        BETA
      </button>
      {open &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()} style={{ fontFamily: "inherit" }}>
            <Modal title="FuerzaLab está en versión beta" onClose={() => setOpen(false)}>
              <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.5 }}>
                La app es nueva y la estamos mejorando cada semana. Puede que encuentres algún detalle que no funcione como
                esperas, o que algunas pantallas cambien.
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                Si algo falla o tienes una idea para mejorarla, escríbenos: nos ayudas mucho. Si puedes, cuéntanos en qué
                pantalla estabas y qué pasó (una captura ayuda).
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <WhatsAppButton
                  phone={SUPPORT_WHATSAPP}
                  primary
                  label="Avisar por WhatsApp"
                  text="Hola, te escribo por FuerzaLab (versión beta). "
                />
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                  Entendido
                </button>
              </div>
            </Modal>
          </div>,
          document.body,
        )}
    </>
  );
}
