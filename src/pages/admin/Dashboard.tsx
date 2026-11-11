import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Chip from "../../components/ui/Chip";
import { paths } from "../../routes/paths";
import { listPlatformEvents, markPlatformEventsSeen, refreshAllOrgBilling, type PlatformEvent } from "../../services/orgBilling";
import WhatsAppButton from "../../components/WhatsAppButton";
import { listOrganizations, listUsers, type OrganizationRow, type UserRow } from "../../services/admin";

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

      <TrialsPanel />
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
  payment_due_soon: { label: "Cobro por vencer", tone: "warn" },
  payment_due_today: { label: "Cobro vence hoy", tone: "bad" },
  seats_requested: { label: "Cupos por pagar", tone: "warn" },
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
    case "payment_due_soon":
      return `El cobro de ${org} (${p.currency ?? ""} ${Number(p.amount ?? 0).toLocaleString("es")}) vence el ${p.due_date ? new Date(p.due_date + "T12:00:00").toLocaleDateString("es") : "pronto"}. Si quieres, recuérdaselo antes.`;
    case "payment_due_today":
      return `El cobro de ${org} (${p.currency ?? ""} ${Number(p.amount ?? 0).toLocaleString("es")}) vence hoy. Si no se registra, mañana se suspende su acceso.`;
    case "seats_requested":
      return `${org} sumó ${p.count ?? 1} ${Number(p.count) === 1 ? "alumno nuevo" : "alumnos nuevos"} por encima de sus cupos. Esperan el pago de ${p.currency ?? ""} ${Number(p.amount ?? 0).toLocaleString("es")} (proporcional a los días que faltan del período). Al marcarlo pagado, entran solos.`;
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
                  {(e.kind === "limit_exceeded" || e.kind === "trial_ending" || e.kind === "org_blocked" || e.kind === "payment_due_soon" || e.kind === "payment_due_today" || e.kind === "seats_requested") && (
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

/**
 * Pruebas gratis que terminan en los próximos 7 días o que ya terminaron
 * (hasta 30 días atrás): las normales sin plan asignado y las "Sin cobro"
 * con fecha de prueba (en esas es solo un recordatorio; no se suspende nada).
 */
function TrialsPanel() {
  const [rows, setRows] = useState<{ org: OrganizationRow; days: number; phone: string | null; contact: string }[] | null>(null);
  useEffect(() => {
    (async () => {
      const [orgs, users] = await Promise.all([listOrganizations(), listUsers().catch((): UserRow[] => [])]);
      const now = Date.now();
      const out = orgs
        .filter((o) => o.trial_ends_at && (o.billing_exempt || !o.plan_id))
        .map((o) => {
          const days = Math.ceil((new Date(o.trial_ends_at!).getTime() - now) / 86400000);
          const trainer = users.find((u) => u.organization_id === o.id && u.role === "trainer" && (o.owner_id ? u.id === o.owner_id : true));
          return { org: o, days, phone: o.contact_phone || trainer?.phone || null, contact: o.contact_name || trainer?.full_name || o.name };
        })
        .filter((r) => r.days <= 7 && r.days >= -30)
        .sort((a, b) => a.days - b.days);
      setRows(out);
    })().catch(() => setRows([]));
  }, []);
  if (!rows || rows.length === 0) return null;
  const when = (d: number) => (d < 0 ? `terminó hace ${-d} ${d === -1 ? "día" : "días"}` : d === 0 ? "termina hoy" : `termina en ${d} ${d === 1 ? "día" : "días"}`);
  return (
    <div className="panel" style={{ marginTop: 20, borderLeft: "4px solid var(--warn)" }}>
      <div className="hd"><h3>Pruebas gratis</h3></div>
      <div className="bd" style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.org.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              <b>{r.org.name}</b>{" "}
              <span style={{ color: r.days < 0 ? "var(--bad)" : "var(--warn)", fontWeight: 600 }}>· la prueba {when(r.days)}</span>
              <div className="note" style={{ fontSize: 12.5 }}>
                {r.org.billing_exempt ? "Sin cobro: es solo un recordatorio, no se suspende." : "Sin plan asignado: al terminar, se suspende si no registras un cobro."}
              </div>
            </span>
            <WhatsAppButton
              phone={r.phone}
              small
              label="Escribirle"
              text={`¡Hola ${r.contact.split(" ")[0]}! ${r.days < 0 ? "Terminó" : "Está por terminar"} tu prueba gratis de FuerzaLab. ¿Cómo te fue? Me encantaría saber qué te pareció y contarte cómo seguir.`}
            />
          </div>
        ))}
        <p className="note" style={{ margin: 0, fontSize: 12.5 }}>
          Para sacar una de la lista: asígnale un plan, o en Organizaciones → «Plan, prueba y contacto» borra la fecha o ponle otra.
        </p>
      </div>
    </div>
  );
}
