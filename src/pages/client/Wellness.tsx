import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import WellnessForm from "../../components/WellnessForm";
import { getMyClientId } from "../../services/clients";
import { listRecentLogs, wellnessScore, wellnessSemaforo, type WellnessLogRow } from "../../services/wellness";
import Loading from "../../components/ui/Loading";

export default function ClientWellness() {
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [recent, setRecent] = useState<WellnessLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const cId = await getMyClientId();
      setClientId(cId);
      if (cId) setRecent(await listRecentLogs(cId, 14));
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--wellness)", flex: "none" }} />
        Bienestar
      </h1>

      {loading ? (
        <Loading />
      ) : !clientId ? (
        <p className="note">Tu cuenta todavía no está vinculada a una ficha de cliente.</p>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 20, maxWidth: 480 }}>
            <div className="bd">
              <WellnessForm clientId={clientId} onSubmitted={load} />
            </div>
          </div>

          {recent.length > 0 && (
            <div className="panel" style={{ maxWidth: 480 }}>
              <div className="hd"><h3>Últimos días</h3></div>
              <div className="bd">
                {recent.map((r) => {
                  const score = wellnessScore(r);
                  const semaforo = wellnessSemaforo(score);
                  return (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                      <span>{new Date(r.log_date).toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      <span className="note">{score} / 100</span>
                      <Chip tone={semaforo.tone}>{semaforo.emoji} {semaforo.label}</Chip>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
