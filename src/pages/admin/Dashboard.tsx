import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Chip from "../../components/ui/Chip";
import { paths } from "../../routes/paths";
import { listPlatformEvents, markPlatformEventsSeen, refreshAllOrgBilling, type PlatformEvent } from "../../services/orgBilling";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [trainerCount, setTrainerCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: orgs, error: orgErr }, { count: trainers, error: trErr }] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "trainer"),
      ]);
      if (cancelled) return;
      if (orgErr || trErr) {
        setError((orgErr ?? trErr)!.message);
        return;
      }
      setOrgCount(orgs ?? 0);
      setTrainerCount(trainers ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Panel de la plataforma</h1>
      <p className="note" style={{ marginBottom: 20 }}>Bienvenido, {profile?.full_name}.</p>

      {error && (
        <div className="panel" style={{ marginBottom: 18, borderColor: "var(--bad)" }}>
          <div className="bd">
            <p className="error-text">No pudimos consultar Supabase: {error}</p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        <div className="panel">
          <div className="bd">
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 700 }}>
              {orgCount ?? "—"}
            </div>
            <div className="note">Organizaciones</div>
          </div>
        </div>
        <div className="panel">
          <div className="bd">
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 700 }}>
              {trainerCount ?? "—"}
            </div>
            <div className="note">Entrenadores</div>
          </div>
        </div>
      </div>

      <PlatformFeed />
    </div>
  );
}

const EVENT_LABEL: Record<PlatformEvent["kind"], { label: string; tone: "ok" | "warn" | "bad" | "pri" }> = {
  client_added: { label: "Alumno nuevo", tone: "ok" },
  trainer_added: { label: "Entrenador nuevo", tone: "pri" },
  limit_exceeded: { label: "Superó el tope", tone: "warn" },
  trial_ending: { label: "Termina la prueba", tone: "warn" },
  org_blocked: { label: "Suspendida por pago", tone: "bad" },
};

function describe(e: PlatformEvent): string {
  const p = e.payload ?? {};
  const org = p.organization ?? "Una organización";
  switch (e.kind) {
    case "client_added":
      return `${p.trainer ?? "Un entrenador"} (${org}) sumó a ${p.client ?? "un alumno"}. Ahora tiene ${p.active_clients ?? "?"} alumnos activos${p.counted_clients > p.active_clients ? ` y ${p.counted_clients - p.active_clients} invitados` : ""}.`;
    case "trainer_added":
      return `${p.trainer ?? "Un entrenador"} se sumó a ${org}.`;
    case "limit_exceeded":
      return `${org} tiene ${p.clients} alumnos y su plan permite ${p.limit}. Tiene 7 días de margen para cambiar de plan.`;
    case "trial_ending":
      return `La prueba gratis de ${org} termina el ${p.trial_ends_at ? new Date(p.trial_ends_at).toLocaleDateString("es") : "pronto"}. Registra su primer cobro para que no se suspenda.`;
    case "org_blocked":
      return `${org} quedó suspendida por falta de pago desde el ${p.since ? new Date(p.since + "T12:00:00").toLocaleDateString("es") : "hoy"}. Sus alumnos siguen entrenando 7 días más.`;
  }
}

/** Novedades de la plataforma: alumnos y entrenadores nuevos, topes, pruebas y suspensiones. */
function PlatformFeed() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<PlatformEvent[] | null>(null);
  const [showSeen, setShowSeen] = useState(false);

  const load = async () => {
    await refreshAllOrgBilling(); // recalcula vencimientos antes de mostrar
    setEvents(await listPlatformEvents(100));
  };
  useEffect(() => {
    load();
  }, []);

  const unseen = (events ?? []).filter((e) => !e.seen_at);
  const shown = showSeen ? events ?? [] : unseen;
  const markSeen = async (ids: string[]) => {
    await markPlatformEventsSeen(ids).catch(() => {});
    setEvents((xs) => (xs ?? []).map((e) => (ids.includes(e.id) ? { ...e, seen_at: new Date().toISOString() } : e)));
  };

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="hd">
        <h3>Novedades de la plataforma {unseen.length > 0 && <span className="note">({unseen.length})</span>}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {unseen.length > 1 && (
            <button className="btn ghost" style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => markSeen(unseen.map((e) => e.id))}>
              Marcar todas como vistas
            </button>
          )}
          <button className="btn ghost" style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setShowSeen((v) => !v)}>
            {showSeen ? "Solo sin ver" : "Ver también las vistas"}
          </button>
        </div>
      </div>
      <div className="bd" style={{ paddingTop: 0 }}>
        {events === null ? (
          <p className="note">Cargando…</p>
        ) : shown.length === 0 ? (
          <p className="note">{events.length === 0 ? "Todavía no hay novedades (o falta correr part3y_migration.sql)." : "Todo visto ✓"}</p>
        ) : (
          shown.map((e) => {
            const meta = EVENT_LABEL[e.kind];
            return (
              <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderTop: "1px solid var(--line)", opacity: e.seen_at ? 0.6 : 1 }}>
                <div style={{ flex: 1 }}>
                  <Chip tone={meta.tone}>{meta.label}</Chip>{" "}
                  <span className="note" style={{ fontSize: 12.5 }}>{new Date(e.created_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <div style={{ marginTop: 4 }}>{describe(e)}</div>
                  {(e.kind === "limit_exceeded" || e.kind === "trial_ending" || e.kind === "org_blocked") && (
                    <button className="link-btn" style={{ fontSize: 13, marginTop: 4 }} onClick={() => navigate(e.kind === "limit_exceeded" ? paths.adminOrgs : paths.adminBilling)}>
                      {e.kind === "limit_exceeded" ? "Ver organizaciones" : "Ir a Pagos de la plataforma"}
                    </button>
                  )}
                </div>
                {!e.seen_at && (
                  <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => markSeen([e.id])}>
                    ✓ Vista
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
