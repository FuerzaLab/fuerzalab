import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Modal from "./ui/Modal";
import {
  REST_SOUNDS,
  REST_VOLUMES,
  getRestSoundChoice,
  getRestVolume,
  previewRestSound,
  restSoundEnabled,
  setRestSoundChoice,
  setRestSoundEnabled,
  setRestVolume,
  unlockRestSound,
  type RestSoundChoice,
  type RestVolume,
} from "../lib/restSound";

/**
 * 🔔 / 🔕: abre el ajuste de la alarma del descanso (prendida/apagada,
 * qué sonido y qué tan fuerte). Queda guardado en este dispositivo.
 */
export default function RestSoundToggle({ style }: { style?: CSSProperties }) {
  const [on, setOn] = useState(restSoundEnabled());
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<RestSoundChoice>(getRestSoundChoice());
  const [volume, setVolume] = useState<RestVolume>(getRestVolume());

  function toggle(next: boolean) {
    setRestSoundEnabled(next);
    setOn(next);
    if (next) {
      unlockRestSound();
      previewRestSound(choice, volume);
    }
  }

  function pick(c: RestSoundChoice) {
    setChoice(c);
    setRestSoundChoice(c);
    unlockRestSound();
    previewRestSound(c, volume);
  }

  function pickVolume(v: RestVolume) {
    setVolume(v);
    setRestVolume(v);
    unlockRestSound();
    previewRestSound(choice, v);
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost"
        style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)", ...style }}
        title={on ? "Alarma del descanso: prendida (tocar para ajustar)" : "Alarma del descanso: apagada (tocar para ajustar)"}
        aria-label="Ajustar la alarma del descanso"
        onClick={(e) => {
          e.stopPropagation();
          unlockRestSound();
          setOpen(true);
        }}
      >
        {on ? "🔔" : "🔕"}
      </button>

      {open &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Modal title="Alarma del descanso" onClose={() => setOpen(false)}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, marginBottom: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} style={{ width: 18, height: 18 }} />
                Sonar al terminar el descanso
              </label>

              <div style={{ opacity: on ? 1 : 0.45, pointerEvents: on ? "auto" : "none" }}>
                <div className="field-label">Sonido (toca uno para escucharlo)</div>
                <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
                  {REST_SOUNDS.map((s) => {
                    const sel = s.id === choice;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pick(s.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: sel ? "2px solid var(--pri)" : "1px solid var(--line)",
                          background: sel ? "var(--pri-soft)" : "#fff",
                          color: "inherit",
                          fontSize: 14,
                          fontWeight: sel ? 600 : 500,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{s.emoji}</span>
                        <span style={{ flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{sel ? "✓ Elegido" : "▶ Escuchar"}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="field-label">Volumen</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {REST_VOLUMES.map((v) => {
                    const sel = v.id === volume;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => pickVolume(v.id)}
                        style={{
                          flex: 1,
                          padding: "9px 6px",
                          borderRadius: 8,
                          border: sel ? "2px solid var(--pri)" : "1px solid var(--line)",
                          background: sel ? "var(--pri-soft)" : "#fff",
                          color: "inherit",
                          fontSize: 13.5,
                          fontWeight: sel ? 600 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="note" style={{ margin: 0 }}>
                Sube también el volumen del celular. Para que suene, deja esta pantalla abierta durante el descanso: si bloqueas el
                celular o cambias de app, el navegador no deja sonar. Se guarda en este dispositivo.
              </p>
            </Modal>
          </div>,
          document.body,
        )}
    </>
  );
}
