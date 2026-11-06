import { useState, type CSSProperties } from "react";
import { restSoundEnabled, setRestSoundEnabled, unlockRestSound, playRestTick } from "../lib/restSound";

/** 🔔 / 🔕: prende o apaga el sonido del descanso (queda guardado en este dispositivo). */
export default function RestSoundToggle({ style }: { style?: CSSProperties }) {
  const [on, setOn] = useState(restSoundEnabled());
  return (
    <button
      type="button"
      className="btn ghost"
      style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)", ...style }}
      title={on ? "Sonido al terminar el descanso: prendido" : "Sonido al terminar el descanso: apagado"}
      aria-label={on ? "Apagar el sonido del descanso" : "Prender el sonido del descanso"}
      onClick={() => {
        const next = !on;
        setRestSoundEnabled(next);
        setOn(next);
        if (next) {
          unlockRestSound();
          playRestTick(); // para que se escuche que quedó prendido
        }
      }}
    >
      {on ? "🔔" : "🔕"}
    </button>
  );
}
