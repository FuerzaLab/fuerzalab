import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { GYM_UNITS_LABEL, type GymUnits } from "../lib/units";
import { getClientGymUnitsRaw, getDefaultGymUnits, setClientGymUnits, setDefaultGymUnits } from "../services/units";

const OPTIONS: GymUnits[] = ["kg", "lb", "mixed"];

/** Configuración → unidad por defecto de los alumnos (para todos los que no tengan una propia). */
export function DefaultGymUnitsPanel() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [value, setValue] = useState<GymUnits | null>(null);
  useEffect(() => {
    if (profile?.organization_id) getDefaultGymUnits(profile.organization_id).then(setValue).catch(() => setValue("kg"));
  }, [profile?.organization_id]);
  if (profile?.role !== "trainer" || value === null) return null;
  return (
    <div className="panel" style={{ marginBottom: 18, maxWidth: 560 }}>
      <div className="hd"><h3>Unidad de las cargas</h3></div>
      <div className="bd">
        <p className="note" style={{ marginTop: 0 }}>
          En qué unidad están los equipos donde entrenan tus alumnos. Se aplica a todos, salvo a los que tengan otra elegida
          en su ficha. Por dentro todo se guarda en kg, así los récords y los gráficos comparan bien.
        </p>
        <select
          className="input"
          value={value}
          onChange={async (e) => {
            const v = e.target.value as GymUnits;
            const prev = value;
            setValue(v);
            try {
              await setDefaultGymUnits(v);
              notify("Unidad por defecto guardada.");
            } catch (err: any) {
              setValue(prev);
              notify(err.message);
            }
          }}
        >
          {OPTIONS.map((o) => (
            <option key={o} value={o}>{GYM_UNITS_LABEL[o]}</option>
          ))}
        </select>
        <p className="note" style={{ fontSize: 12.5, marginBottom: 0 }}>
          En "Mixto", los ejercicios con equipamiento Máquina o Polea van en libras y el resto en kg. Siempre se puede cambiar
          en la rutina (Constructor) o al cargar cada serie, con el botón kg / lb.
        </p>
      </div>
    </div>
  );
}

/** Ficha del cliente → dónde entrena (kg, lb o mixto), o "como el resto de tus alumnos". */
export function ClientGymUnitsField({ clientId }: { clientId: string }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [own, setOwn] = useState<GymUnits | null | undefined>(undefined);
  const [def, setDef] = useState<GymUnits>("kg");
  useEffect(() => {
    getClientGymUnitsRaw(clientId).then(setOwn).catch(() => setOwn(null));
    if (profile?.organization_id) getDefaultGymUnits(profile.organization_id).then(setDef).catch(() => {});
  }, [clientId, profile?.organization_id]);
  if (own === undefined) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">Gimnasio donde entrena (unidad de las cargas)</label>
      <select
        className="input"
        value={own ?? ""}
        onChange={async (e) => {
          const v = (e.target.value || null) as GymUnits | null;
          const prev = own;
          setOwn(v);
          try {
            await setClientGymUnits(clientId, v);
            notify("Unidad del gimnasio guardada.");
          } catch (err: any) {
            setOwn(prev);
            notify(err.message);
          }
        }}
      >
        <option value="">Como el resto de tus alumnos ({GYM_UNITS_LABEL[def].split(":")[0]})</option>
        {OPTIONS.map((o) => (
          <option key={o} value={o}>{GYM_UNITS_LABEL[o]}</option>
        ))}
      </select>
    </div>
  );
}
