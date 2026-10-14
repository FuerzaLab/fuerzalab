import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { paths } from "../../routes/paths";
import { listClients, type ClientRow } from "../../services/clients";
import { listTodayLogsForTrainer, wellnessScore, wellnessSemaforo, type WellnessLogRow } from "../../services/wellness";

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [todayLogs, setTodayLogs] = useState<WellnessLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listClients(), listTodayLogsForTrainer()])
      .then(([c, l]) => {
        setClients(c);
        setTodayLogs(l);
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameFor = (clientId: string) => clients.find((c) => c.id === clientId)?.full_name ?? "Cliente";
  const redToday = todayLogs.filter((l) => wellnessScore(l) < 60);
  const yellowToday = todayLogs.filter((l) => { const s = wellnessScore(l); return s >= 60 && s < 80; });

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Esto es lo que pasó hoy con el bienestar de tus clientes.</p>

      {loading ? (
        <p className="note">Cargando…</p>
      ) : (
        <>
          {(redToday.length > 0 || yellowToday.length > 0) && (
            <div className="panel" style={{ marginBottom: 20, borderLeft: `4px solid ${redToday.length > 0 ? "var(--bad)" : "var(--warn)"}` }}>
              <div className="hd"><h3>Alertas de bienestar — hoy</h3></div>
              <div className="bd">
                {redToday.map((l) => {
                  const semaforo = wellnessSemaforo(wellnessScore(l));
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => navigate(paths.trainerWellness)}>
                      <span><b>{nameFor(l.client_id)}</b> — {semaforo.recommendation}</span>
                      <Chip tone="bad">{semaforo.emoji} {wellnessScore(l)}/100</Chip>
                    </div>
                  );
                })}
                {yellowToday.map((l) => {
                  const semaforo = wellnessSemaforo(wellnessScore(l));
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => navigate(paths.trainerWellness)}>
                      <span>{nameFor(l.client_id)} — {semaforo.recommendation}</span>
                      <Chip tone="warn">{semaforo.emoji} {wellnessScore(l)}/100</Chip>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {redToday.length === 0 && yellowToday.length === 0 && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="bd">
                <p className="note">
                  {todayLogs.length > 0
                    ? "Ningún cliente con alerta de bienestar hoy. 🟢"
                    : "Todavía no hay registros de bienestar hoy — se completan cuando cada cliente inicia su rutina programada."}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
