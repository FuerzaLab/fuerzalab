import { useEffect, useState } from "react";
import { currentPlanToHandOff, type CurrentPlanInfo, type Handoff } from "../services/programHandoff";

/**
 * Al crear un plan nuevo para un alumno que todavía tiene un plan en curso:
 * ¿que primero termine el anterior, o reemplazarlo ya? (part4s)
 * Avisa al padre si hace falta elegir (info) y qué eligió (value).
 */
export default function PlanHandoffPicker({
  clientId,
  value,
  onChange,
  onInfo,
}: {
  clientId: string;
  value: Handoff;
  onChange: (v: Handoff) => void;
  onInfo?: (info: CurrentPlanInfo | null) => void;
}) {
  const [info, setInfo] = useState<CurrentPlanInfo | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setInfo(undefined);
    if (!clientId) {
      setInfo(null);
      onInfo?.(null);
      return;
    }
    currentPlanToHandOff(clientId).then((r) => {
      if (!alive) return;
      setInfo(r);
      onInfo?.(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (info === undefined) return <p className="note" style={{ marginBottom: 12 }}>Revisando su plan actual…</p>;
  if (!info) return null;

  const fixed = info.pending == null;
  const options: { v: Handoff; title: string; desc: string }[] = [
    {
      v: "queue",
      title: fixed ? `Dejar el nuevo en espera` : `Que primero termine «${info.program.name}»`,
      desc: fixed
        ? `Sigue con sus rutinas fijas hasta que tú actives el nuevo con «Empezar ya» (en Planificación).`
        : `Le ${info.pending === 1 ? "queda 1 rutina" : `quedan ${info.pending} rutinas`}. El plan nuevo empieza solo cuando las haga (o las marques como saltadas). Lo puedes adelantar con «Empezar ya».`,
    },
    {
      v: "replace",
      title: `Reemplazar «${info.program.name}» ya`,
      desc: "Pasa al plan nuevo ahora. El anterior queda cerrado con su historial (si está haciendo una rutina, la puede terminar).",
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="field-label">Este alumno todavía tiene un plan en curso</div>
      <div style={{ display: "grid", gap: 6 }}>
        {options.map((o) => (
          <label
            key={o.v}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "9px 11px",
              borderRadius: 8,
              border: value === o.v ? "2px solid var(--pri)" : "1px solid var(--line)",
              cursor: "pointer",
            }}
          >
            <input type="radio" name="plan-handoff" checked={value === o.v} onChange={() => onChange(o.v)} style={{ marginTop: 3 }} />
            <span>
              <b style={{ fontSize: 14 }}>{o.title}</b>
              <span className="note" style={{ display: "block", fontSize: 12.5 }}>{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
