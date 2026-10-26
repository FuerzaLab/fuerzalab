import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { paths } from "../../routes/paths";
import { listClients, type ClientRow } from "../../services/clients";
import { loadFeed, dismissItems, FEED_KIND_LABEL, type FeedItem, type FeedKind } from "../../services/dashboardFeed";
import { computeSuggestions } from "../../services/suggestions";
import { getTodaysSessionForClient, type TodaysSession } from "../../services/sessions";
import Loading from "../../components/ui/Loading";
import Watermark from "../../components/ui/Watermark";
import ConfirmModal from "../../components/ui/ConfirmModal";

const SESSION_STATUS_LABEL: Record<TodaysSession["status"], string> = {
  pending: "Todavía no la empezó",
  in_progress: "La está haciendo ahora",
  completed: "Ya la completó",
  skipped: "La saltó",
};

export default function TrainerDashboard() {
  const { profile, can } = useAuth();
  // Para un asistente, Sugerencias solo si tiene ese permiso (las Novedades
  // se filtran solas según sus permisos, ver FeedPanel).
  const showSuggestions = can("analytics");
  const { notify } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionCount, setSuggestionCount] = useState<number | null>(null);
  const [todaysSessions, setTodaysSessions] = useState<TodaysSession[] | null>(null);

  useEffect(() => {
    listClients()
      .then(async (c) => {
        setClients(c);
        const active = c.filter((x) => x.status === "active");
        const results = await Promise.all(active.map((x) => getTodaysSessionForClient(x.id).catch(() => null)));
        setTodaysSessions(results.filter((r): r is TodaysSession => r != null));
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    computeSuggestions().then((s) => setSuggestionCount(s.length)).catch(() => setSuggestionCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameFor = (clientId: string) => clients.find((c) => c.id === clientId)?.full_name ?? "Cliente";

  return (
    <div className="page">
      <Watermark />
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>
        {profile?.role === "staff" ? "Esto es lo que está pasando con los clientes." : "Esto es lo que está pasando con tus clientes."}
      </p>

      {loading ? (
        <Loading />
      ) : (
        <>
          {todaysSessions && todaysSessions.length > 0 && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="hd"><h3>Hoy</h3></div>
              <div className="bd">
                {todaysSessions.map((t) => (
                  <div key={t.session.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <span><b>{nameFor(t.clientId)}</b> — {t.session.name}</span>
                    <Chip tone={t.status === "completed" ? "ok" : t.status === "in_progress" ? "warn" : ""}>{SESSION_STATUS_LABEL[t.status]}</Chip>
                  </div>
                ))}
                <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
                  Solo aparecen acá los clientes cuyo programa tiene fecha de inicio puesta (en Planificación) y una rutina asignada al día de hoy.
                </p>
              </div>
            </div>
          )}

          <FeedPanel clients={clients} />

          {showSuggestions && suggestionCount !== null && suggestionCount > 0 && (
            <p className="note" style={{ cursor: "pointer" }} onClick={() => navigate(paths.trainerSuggestions)}>
              Hay {suggestionCount} sugerencia{suggestionCount === 1 ? "" : "s"} más esperando — ver Sugerencias.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// --- Novedades ------------------------------------------------------------

const KIND_ORDER: FeedKind[] = ["record", "measure", "note", "wellness", "skip", "photos"];

function relDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff <= 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 7) return `hace ${diff} días`;
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/**
 * Novedades de los clientes (récords, medidas que cargaron, comentarios al
 * terminar la rutina, alertas de bienestar, rutinas saltadas y fotos
 * nuevas). Cada una se marca como "Atendida" y deja de aparecer.
 */
function FeedPanel({ clients }: { clients: ClientRow[] }) {
  const { can } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [filter, setFilter] = useState<FeedKind | "all">("all");
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    if (!clients.length) {
      setItems([]);
      return;
    }
    loadFeed(clients, { logs: can("logs"), assessments: can("assessments"), health: can("health"), files: can("files") })
      .then(setItems)
      .catch((e: any) => {
        notify(e.message);
        setItems([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const nameFor = (id: string) => clients.find((c) => c.id === id)?.full_name ?? "Cliente";

  const linkFor = (i: FeedItem): string => {
    if (i.kind === "wellness" && can("health")) return paths.trainerWellness;
    if (i.kind === "photos" && can("files")) return paths.trainerProgressPhotos;
    if ((i.kind === "record" || i.kind === "measure") && can("analytics")) return paths.trainerReports;
    return paths.trainerClientDetail(i.clientId);
  };

  const dismiss = async (keys: string[]) => {
    const before = items;
    setItems((xs) => (xs ? xs.filter((x) => !keys.includes(x.key)) : xs));
    try {
      await dismissItems(keys);
    } catch (e: any) {
      setItems(before);
      notify(e.message?.includes("dashboard_dismissals") ? "Falta correr part3r_migration.sql en Supabase." : e.message);
    }
  };

  if (items === null) return <div className="panel" style={{ marginBottom: 20 }}><div className="bd"><Loading /></div></div>;

  const counts = new Map<FeedKind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3>Novedades {items.length > 0 && <span className="note" style={{ fontWeight: 400 }}>({items.length})</span>}</h3>
        {shown.length > 1 && (
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setConfirmAll(true)}>
            Marcar {filter === "all" ? "todas" : "estas"} como atendidas
          </button>
        )}
      </div>
      <div className="bd">
        {items.length === 0 ? (
          <p className="note" style={{ margin: 0 }}>Todo al día ✓ — no hay novedades de tus clientes sin atender.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <button className={`btn ${filter === "all" ? "" : "ghost"}`} style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setFilter("all")}>
                Todas ({items.length})
              </button>
              {KIND_ORDER.filter((k) => counts.get(k)).map((k) => (
                <button key={k} className={`btn ${filter === k ? "" : "ghost"}`} style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setFilter(k)}>
                  {FEED_KIND_LABEL[k]} ({counts.get(k)})
                </button>
              ))}
            </div>
            {shown.map((i) => (
              <div key={i.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(linkFor(i))}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip tone={i.tone}>{FEED_KIND_LABEL[i.kind]}</Chip>
                    <b>{nameFor(i.clientId)}</b>
                    <span className="note" style={{ fontSize: 12.5 }}>{relDay(i.at)}</span>
                  </div>
                  <div style={{ marginTop: 3 }}>{i.title}</div>
                  {i.detail && <div className="note" style={{ fontSize: 13, marginTop: 2, overflowWrap: "anywhere" }}>{i.detail}</div>}
                </div>
                <button
                  className="btn ghost"
                  title="Marcar como atendida"
                  style={{ padding: "5px 10px", fontSize: 12.5, flex: "none" }}
                  onClick={() => dismiss([i.key])}
                >
                  ✓ Atendida
                </button>
              </div>
            ))}
          </>
        )}
        <p className="note" style={{ fontSize: 12, margin: "10px 0 0" }}>
          Se muestran los últimos 30 días (bienestar: últimos 7). Lo que marcás como atendido deja de aparecer solo para vos.
        </p>
      </div>

      {confirmAll && (
        <ConfirmModal
          title="Marcar como atendidas"
          message={`¿Marcar ${shown.length} novedades como atendidas? Dejan de aparecer en Inicio.`}
          confirmLabel="Marcar como atendidas"
          onClose={() => setConfirmAll(false)}
          onConfirm={() => {
            setConfirmAll(false);
            dismiss(shown.map((i) => i.key));
          }}
        />
      )}
    </div>
  );
}
