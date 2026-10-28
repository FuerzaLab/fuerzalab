import { useEffect, useState } from "react";
import { useToast } from "../../../contexts/ToastContext";
import Chip from "../../../components/ui/Chip";
import { listClients, type ClientRow } from "../../../services/clients";
import {
  listRecentLogs,
  setTrainerAdjustment,
  wellnessScore,
  wellnessSemaforo,
  lowFields,
  rollingAverage7,
  trend,
  WELLNESS_FIELD_LABEL,
  type WellnessLogRow,
} from "../../../services/wellness";
import Loading from "../../../components/ui/Loading";
import SearchSelect from "../../../components/ui/SearchSelect";
import EmptyState from "../../../components/ui/EmptyState";

export default function WellnessPage() {
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [logs, setLogs] = useState<WellnessLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (cId: string) => {
    setLoading(true);
    try {
      const data = await listRecentLogs(cId, 30);
      setLogs(data);
      const adj: Record<string, string> = {};
      for (const l of data) adj[l.id] = l.trainer_adjustment ?? "";
      setAdjustments(adj);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (clientId) load(clientId);
    else setLogs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.log_date === today);
  const redDays = logs.filter((l) => wellnessScore(l) < 60).length;

  const saveAdjustment = async (logId: string) => {
    try {
      await setTrainerAdjustment(logId, adjustments[logId] ?? "");
      notify("Guardado.");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--wellness)", flex: "none" }} />
        Bienestar
      </h1>
      <p className="note" style={{ marginBottom: 20 }}>
        Cuestionario diario (sueño, fatiga, energía, estrés, dolor muscular), de 1 a 5 cada uno — 5 siempre es el mejor estado. Wellness Score de 0 a 100: por encima de 80 óptimo, 60-79 precaución, menos de 60 riesgo.
      </p>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <SearchSelect className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </SearchSelect>
      </div>

      {!clientId && <p className="note">Elige un cliente para ver su historial de los últimos 30 días.</p>}

      {clientId && loading && <Loading />}

      {clientId && !loading && logs.length === 0 && (
        <EmptyState title="Todavía no hay registros de bienestar">
          Tu alumno responde un cuestionario corto antes de entrenar, desde su app: sueño, energía, estrés y dolor. Cuando lo
          complete, acá vas a ver cómo llega cada día, con un semáforo.
        </EmptyState>
      )}

      {clientId && !loading && logs.length > 0 && (
        <>
          {!todayLog && <p className="note" style={{ marginBottom: 14 }}>Todavía no completó el registro de hoy.</p>}
          {redDays > 0 && (
            <div className="panel" style={{ marginBottom: 18, borderLeft: "4px solid var(--bad)" }}>
              <div className="bd">
                <b>{redDays} día{redDays === 1 ? "" : "s"} en 🔴 Riesgo</b> en los últimos 30 días — vale la pena revisar carga, descanso o sueño con este cliente.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {logs.map((l, i) => {
              const score = wellnessScore(l);
              const semaforo = wellnessSemaforo(score);
              const flagged = lowFields(l);
              const rolling = rollingAverage7(logs.slice(i));
              const tr = trend(score, rolling);
              return (
                <div key={l.id} className="panel">
                  <div className="bd">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                      <b>{new Date(l.log_date).toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "2-digit" })}</b>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="note">Score <b>{score}</b>/100</span>
                        <span className="note">Prom. 7d <b>{rolling}</b></span>
                        <span className="note">{tr.arrow} {tr.label}</span>
                        <Chip tone={semaforo.tone}>{semaforo.emoji} {semaforo.label}</Chip>
                      </div>
                    </div>
                    <p className="note" style={{ marginBottom: 6 }}>{semaforo.recommendation}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 8, fontSize: 14 }}>
                      {l.sleep_hours != null && <div><span className="note">Horas de sueño</span><div>{l.sleep_hours} h</div></div>}
                      <div><span className="note">{WELLNESS_FIELD_LABEL.sleep_quality}</span><div>{l.sleep_quality}</div></div>
                      <div><span className="note">{WELLNESS_FIELD_LABEL.fatigue}</span><div>{l.fatigue}</div></div>
                      <div><span className="note">{WELLNESS_FIELD_LABEL.energy}</span><div>{l.energy}</div></div>
                      <div><span className="note">{WELLNESS_FIELD_LABEL.stress}</span><div>{l.stress}</div></div>
                      <div><span className="note">{WELLNESS_FIELD_LABEL.soreness}</span><div>{l.soreness}</div></div>
                    </div>
                    {l.pain_location && <p className="note" style={{ marginBottom: 6 }}>Dolor en: {l.pain_location}</p>}
                    {l.notes && <p className="note" style={{ marginBottom: 6 }}>Comentario del cliente: {l.notes}</p>}
                    {flagged.length > 0 && (
                      <p style={{ color: "var(--bad)", fontSize: 13.5, marginBottom: 10 }}>
                        Atención puntual en: {flagged.map((f) => WELLNESS_FIELD_LABEL[f]).join(", ")}.
                      </p>
                    )}
                    <label className="field-label">Ajuste aplicado</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input"
                        placeholder="Ej. Redujo volumen 20%, trabajo regenerativo"
                        value={adjustments[l.id] ?? ""}
                        onChange={(e) => setAdjustments((a) => ({ ...a, [l.id]: e.target.value }))}
                      />
                      <button className="btn ghost" style={{ flex: "none" }} onClick={() => saveAdjustment(l.id)}>Guardar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
