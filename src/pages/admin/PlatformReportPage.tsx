import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import Loading from "../../components/ui/Loading";
import Chip from "../../components/ui/Chip";
import { listOrganizations, listUsers, type OrganizationRow, type UserRow } from "../../services/admin";
import { BILLING_PERIOD_LABEL, listOrganizationSubscriptions, listPlatformPlans, type OrganizationSubscriptionRow, type PlatformPlanRow } from "../../services/billing";
import { orgPeriodAmount } from "../../services/orgBilling";
import { exportReportPdf } from "../../lib/exportReportPdf";
import { supabase } from "../../lib/supabase";

/**
 * Super Admin → Reportes: cuántos entrenadores tiene cada organización,
 * cuántos alumnos tiene cada entrenador y cada organización, y los cobros
 * del mes. Con filtros, exportación a Excel y "Estado de cuenta" en PDF por
 * organización (para mandárselo al estudio o al entrenador).
 */
type ClientLite = { id: string; organization_id: string; trainer_id: string; status: string; seat_pending?: boolean; full_name: string; created_at: string };
type Counts = { active: number; prospect: number; paused: number; archived: number; pendingSeat: number };

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");
const emptyCounts = (): Counts => ({ active: 0, prospect: 0, paused: 0, archived: 0, pendingSeat: 0 });
const add = (c: Counts, cl: ClientLite) => {
  if (cl.status === "active") c.active++;
  else if (cl.status === "prospect") c.prospect++;
  else if (cl.status === "paused") c.paused++;
  else c.archived++;
  if (cl.seat_pending) c.pendingSeat++;
};
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const monthLabel = (k: string) => new Date(k + "-15T12:00:00").toLocaleDateString("es", { month: "long", year: "numeric" });
const money = (n: number, cur = "Bs") => `${cur} ${Math.round(n).toLocaleString("es")}`;

export default function PlatformReportPage() {
  const { notify } = useToast();
  const [orgs, setOrgs] = useState<OrganizationRow[] | null>(null);
  const [trainers, setTrainers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [plans, setPlans] = useState<PlatformPlanRow[]>([]);
  const [subs, setSubs] = useState<OrganizationSubscriptionRow[]>([]);
  const [estimates, setEstimates] = useState<Record<string, number | null>>({});
  const [orgFilter, setOrgFilter] = useState("all");
  const [withExempt, setWithExempt] = useState(false);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statementOrg, setStatementOrg] = useState<OrganizationRow | null>(null);
  const statementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [o, u, c, p, s] = await Promise.all([
        listOrganizations(),
        listUsers(),
        supabase.from("clients").select("*").then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ClientLite[];
        }),
        listPlatformPlans().catch((): PlatformPlanRow[] => []),
        listOrganizationSubscriptions().catch((): OrganizationSubscriptionRow[] => []),
      ]);
      setTrainers(u.filter((x) => x.role === "trainer"));
      setClients(c);
      setPlans(p);
      setSubs(s);
      setOrgs(o);
      const est = await Promise.all(o.map(async (x) => [x.id, x.plan_id ? await orgPeriodAmount(x.id) : null] as const));
      setEstimates(Object.fromEntries(est));
    })().catch((e) => {
      notify(e.message);
      setOrgs([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthsAvailable = useMemo(() => {
    const ks = new Set<string>([monthKey(new Date())]);
    for (const x of subs) ks.add(x.due_date.slice(0, 7));
    return [...ks].sort().reverse();
  }, [subs]);

  const rows = useMemo(() => {
    if (!orgs) return [];
    return orgs
      .filter((o) => (withExempt || !o.billing_exempt) && (orgFilter === "all" || o.id === orgFilter))
      .map((o) => {
        const ts = trainers.filter((t) => t.organization_id === o.id);
        const cs = clients.filter((c) => c.organization_id === o.id);
        const counts = emptyCounts();
        cs.forEach((c) => add(counts, c));
        const byTrainer = ts.map((t) => {
          const k = emptyCounts();
          cs.filter((c) => c.trainer_id === t.id).forEach((c) => add(k, c));
          return { trainer: t, counts: k };
        });
        const monthSubs = subs.filter((x) => x.organization_id === o.id && x.due_date.slice(0, 7) === month && x.status !== "cancelled");
        const today = new Date().toISOString().slice(0, 10);
        const sum = (f: (x: OrganizationSubscriptionRow) => boolean) => monthSubs.filter(f).reduce((t, x) => t + Number(x.amount), 0);
        return {
          org: o,
          plan: plans.find((p) => p.id === o.plan_id) ?? null,
          trainers: ts,
          byTrainer,
          counts,
          billable: counts.active + counts.prospect,
          paid: sum((x) => x.status === "paid"),
          pending: sum((x) => x.status !== "paid" && x.due_date >= today),
          overdue: sum((x) => x.status !== "paid" && x.due_date < today),
          monthSubs,
          currency: monthSubs[0]?.currency ?? plans.find((p) => p.id === o.plan_id)?.currency ?? "Bs",
        };
      });
  }, [orgs, trainers, clients, plans, subs, orgFilter, withExempt, month]);

  const totals = rows.reduce(
    (t, r) => ({
      orgs: t.orgs + 1,
      trainers: t.trainers + r.trainers.length,
      active: t.active + r.counts.active,
      prospect: t.prospect + r.counts.prospect,
      paused: t.paused + r.counts.paused,
      paid: t.paid + r.paid,
      pending: t.pending + r.pending,
      overdue: t.overdue + r.overdue,
    }),
    { orgs: 0, trainers: 0, active: 0, prospect: 0, paused: 0, paid: 0, pending: 0, overdue: 0 },
  );

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rows.map((r) => ({
            Organización: r.org.name,
            Contacto: r.org.contact_name ?? "",
            WhatsApp: r.org.contact_phone ?? "",
            Correo: r.org.contact_email ?? "",
            Plan: r.org.billing_exempt ? "Sin cobro" : r.plan?.name ?? "Sin plan",
            Entrenadores: r.trainers.length,
            "Alumnos activos": r.counts.active,
            Invitados: r.counts.prospect,
            "En pausa": r.counts.paused,
            "Dados de baja": r.counts.archived,
            "Alumnos que se cobran": r.billable,
            "Esperando pago de cupo": r.counts.pendingSeat,
            "Próximo período (estimado)": estimates[r.org.id] ?? "",
            [`Cobrado (${monthLabel(month)})`]: r.paid,
            [`Pendiente (${monthLabel(month)})`]: r.pending,
            [`Vencido (${monthLabel(month)})`]: r.overdue,
          })),
        ),
        "Organizaciones",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rows.flatMap((r) =>
            r.byTrainer.map((b) => ({
              Organización: r.org.name,
              Entrenador: b.trainer.full_name,
              Correo: b.trainer.email,
              "Alumnos activos": b.counts.active,
              Invitados: b.counts.prospect,
              "En pausa": b.counts.paused,
              "Dados de baja": b.counts.archived,
              Total: b.counts.active + b.counts.prospect + b.counts.paused + b.counts.archived,
            })),
          ),
        ),
        "Entrenadores",
      );
      const ids = new Set(rows.map((r) => r.org.id));
      const trainerName = (id: string) => trainers.find((t) => t.id === id)?.full_name ?? "";
      const orgName = (id: string) => orgs?.find((o) => o.id === id)?.name ?? "";
      const label: Record<string, string> = { active: "Activo", prospect: "Invitado", paused: "En pausa", archived: "Dado de baja" };
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          clients
            .filter((c) => ids.has(c.organization_id))
            .map((c) => ({
              Organización: orgName(c.organization_id),
              Entrenador: trainerName(c.trainer_id),
              Alumno: c.full_name,
              Estado: label[c.status] ?? c.status,
              "Esperando pago de cupo": c.seat_pending ? "Sí" : "",
              Alta: c.created_at.slice(0, 10),
            })),
        ),
        "Alumnos",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rows.flatMap((r) =>
            r.monthSubs.map((x) => ({
              Organización: r.org.name,
              Concepto: x.kind === "seats" ? `Cupos (${x.seats_count ?? 1} alumnos)` : x.plan_name ?? "Período",
              Monto: Number(x.amount),
              Moneda: x.currency,
              Vencimiento: x.due_date,
              Estado: x.status === "paid" ? "Pagado" : x.due_date < new Date().toISOString().slice(0, 10) ? "Vencido" : "Pendiente",
              "Pagado el": x.paid_at ? x.paid_at.slice(0, 10) : "",
            })),
          ),
        ),
        "Cobros del mes",
      );
      XLSX.writeFile(wb, `FuerzaLab-reporte-${month}.xlsx`);
    } catch (e: any) {
      notify("No se pudo exportar: " + e.message);
    }
  };

  // Estado de cuenta en PDF: se dibuja la hoja oculta y se exporta.
  useEffect(() => {
    if (!statementOrg || !statementRef.current) return;
    const el = statementRef.current;
    const t = setTimeout(async () => {
      try {
        await exportReportPdf(el, `Estado-de-cuenta-${statementOrg.name.replace(/\s+/g, "-")}-${month}`);
      } catch (e: any) {
        notify("No se pudo generar el PDF: " + e.message);
      }
      setStatementOrg(null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementOrg]);

  if (!orgs) return <div className="page"><Loading text="Armando el reporte…" /></div>;
  const st = statementOrg ? rows.find((r) => r.org.id === statementOrg.id) : null;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px" }}>Reportes</h1>
          <p className="note" style={{ margin: 0 }}>Entrenadores y alumnos de cada organización, y sus cobros del mes.</p>
        </div>
        <button className="btn" onClick={exportExcel}>Exportar a Excel</button>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="bd pr-filters">
          <label>
            <span className="field-label">Organización</span>
            <select className="input" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
              <option value="all">Todas</option>
              {orgs.filter((o) => withExempt || !o.billing_exempt).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Mes de los cobros</span>
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthsAvailable.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
            </select>
          </label>
          <label className="pr-check">
            <input type="checkbox" checked={withExempt} onChange={(e) => setWithExempt(e.target.checked)} />
            <span>Incluir las organizaciones sin cobro (demo, la tuya)</span>
          </label>
        </div>
      </div>

      <div className="pr-cards">
        <div className="panel"><div className="bd"><b>{totals.orgs}</b><span>organizaciones</span></div></div>
        <div className="panel"><div className="bd"><b>{totals.trainers}</b><span>entrenadores</span></div></div>
        <div className="panel"><div className="bd"><b>{totals.active}</b><span>alumnos activos</span><em>+{totals.prospect} invitados · {totals.paused} en pausa</em></div></div>
        <div className="panel"><div className="bd"><b style={{ color: "var(--ok)" }}>{money(totals.paid)}</b><span>cobrado en {monthLabel(month)}</span></div></div>
        <div className="panel"><div className="bd"><b>{money(totals.pending)}</b><span>por cobrar</span>{totals.overdue > 0 && <em style={{ color: "var(--bad)" }}>{money(totals.overdue)} vencido</em>}</div></div>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="pr-table">
          <thead>
            <tr>
              <th>Organización</th>
              <th>Plan</th>
              <th>Entrenadores</th>
              <th>Activos</th>
              <th>Invitados</th>
              <th>En pausa</th>
              <th title="Activos + invitados (los que ocupan un cupo)">Se cobran</th>
              <th>Próximo período</th>
              <th>Cobros de {monthLabel(month)}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="note" style={{ padding: 16 }}>No hay organizaciones con este filtro.</td></tr>
            )}
            {rows.map((r) => {
              const open = expanded.has(r.org.id);
              return (
                <Fragment key={r.org.id}>
                  <tr>
                    <td>
                      <button className="link-btn" style={{ fontWeight: 700 }} onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(r.org.id)) n.delete(r.org.id); else n.add(r.org.id); return n; })}>
                        {open ? "▾" : "▸"} {r.org.name}
                      </button>
                      {r.org.status === "suspended" && <div><Chip tone="bad">Suspendida</Chip></div>}
                    </td>
                    <td>{r.org.billing_exempt ? <span className="note">Sin cobro</span> : r.plan?.name ?? <span className="note">Sin plan</span>}</td>
                    <td>{r.trainers.length}</td>
                    <td><b>{r.counts.active}</b></td>
                    <td>{r.counts.prospect}</td>
                    <td>{r.counts.paused}</td>
                    <td>
                      <b>{r.billable}</b>
                      {r.counts.pendingSeat > 0 && <div className="note" style={{ fontSize: 12 }}>{r.counts.pendingSeat} esperan cupo</div>}
                    </td>
                    <td>{estimates[r.org.id] != null ? money(estimates[r.org.id]!, r.currency) : "—"}</td>
                    <td style={{ minWidth: 150 }}>
                      {r.monthSubs.length === 0 ? (
                        <span className="note">Sin cobros</span>
                      ) : (
                        <div style={{ display: "grid", gap: 2, fontSize: 13 }}>
                          {r.paid > 0 && <span style={{ color: "var(--ok)" }}>Pagado {money(r.paid, r.currency)}</span>}
                          {r.pending > 0 && <span>Pendiente {money(r.pending, r.currency)}</span>}
                          {r.overdue > 0 && <span style={{ color: "var(--bad)" }}>Vencido {money(r.overdue, r.currency)}</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 12.5, whiteSpace: "nowrap" }} onClick={() => setStatementOrg(r.org)} disabled={!!statementOrg}>
                        {statementOrg?.id === r.org.id ? "Generando…" : "Estado de cuenta"}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="pr-sub">
                      <td colSpan={10}>
                        {r.byTrainer.length === 0 ? (
                          <span className="note">Sin entrenadores todavía.</span>
                        ) : (
                          <table className="pr-inner">
                            <thead><tr><th>Entrenador</th><th>Activos</th><th>Invitados</th><th>En pausa</th><th>Dados de baja</th></tr></thead>
                            <tbody>
                              {r.byTrainer.map((b) => (
                                <tr key={b.trainer.id}>
                                  <td>{b.trainer.full_name}{r.org.owner_id === b.trainer.id && <span className="chip pri" style={{ marginLeft: 6, fontSize: 11 }}>Dueño</span>}</td>
                                  <td><b>{b.counts.active}</b></td>
                                  <td>{b.counts.prospect}</td>
                                  <td>{b.counts.paused}</td>
                                  <td>{b.counts.archived}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ fontSize: 12.5, marginTop: 10 }}>
        "Se cobran" son los alumnos activos e invitados (los que ocupan un cupo); los en pausa y dados de baja no se cobran.
        "Próximo período" es lo que se cobraría hoy con su plan y sus alumnos.
      </p>

      {/* Hoja del estado de cuenta (oculta; se exporta a PDF). */}
      {st && (
        <div style={{ position: "fixed", left: -10000, top: 0, width: 794 }}>
          <div ref={statementRef} className="statement">
            <div className="statement-head">
              <div>
                <div className="statement-brand">Fuerza<span>Lab</span></div>
                <div className="note">Estado de cuenta</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <b style={{ fontSize: 18 }}>{st.org.name}</b>
                {(st.org.contact_name || st.org.contact_phone || st.org.contact_email) && (
                  <div className="note">{[st.org.contact_name, st.org.contact_phone, st.org.contact_email].filter(Boolean).join(" · ")}</div>
                )}
                <div className="note">{monthLabel(month)} · emitido el {new Date().toLocaleDateString("es")}</div>
              </div>
            </div>

            <h3>Plan</h3>
            {st.plan ? (
              <p style={{ margin: "0 0 4px" }}>
                <b>{st.plan.name}</b> — {BILLING_PERIOD_LABEL[st.plan.billing_period]}:{" "}
                {st.plan.price > 0 && money(st.plan.price, st.plan.currency)}
                {st.plan.price_per_client ? ` ${st.plan.price > 0 ? "+ " : ""}${money(st.plan.price_per_client, st.plan.currency)} por alumno${st.plan.included_clients ? ` (desde el alumno ${st.plan.included_clients + 1})` : ""}` : ""}
                {st.plan.trainer_limit ? ` · hasta ${st.plan.trainer_limit} entrenadores` : ""}
              </p>
            ) : (
              <p className="note">Sin plan asignado.</p>
            )}

            <h3>Entrenadores y alumnos</h3>
            <table className="statement-table">
              <thead><tr><th>Entrenador</th><th>Activos</th><th>Invitados</th><th>Se cobran</th></tr></thead>
              <tbody>
                {st.byTrainer.map((b) => (
                  <tr key={b.trainer.id}><td>{b.trainer.full_name}</td><td>{b.counts.active}</td><td>{b.counts.prospect}</td><td><b>{b.counts.active + b.counts.prospect}</b></td></tr>
                ))}
                <tr className="tot"><td>Total</td><td>{st.counts.active}</td><td>{st.counts.prospect}</td><td>{st.billable}</td></tr>
              </tbody>
            </table>

            <h3>Cobros de {monthLabel(month)}</h3>
            {st.monthSubs.length === 0 ? (
              <p className="note">No hay cobros registrados este mes.</p>
            ) : (
              <table className="statement-table">
                <thead><tr><th>Concepto</th><th>Vence</th><th>Estado</th><th style={{ textAlign: "right" }}>Monto</th></tr></thead>
                <tbody>
                  {st.monthSubs.map((x) => (
                    <tr key={x.id}>
                      <td>{x.kind === "seats" ? `Cupos para ${x.seats_count ?? 1} ${x.seats_count === 1 ? "alumno nuevo" : "alumnos nuevos"}` : `${x.plan_name ?? "Plan"} — período`}</td>
                      <td>{new Date(x.due_date + "T12:00:00").toLocaleDateString("es")}</td>
                      <td>{x.status === "paid" ? `Pagado${x.paid_at ? " el " + new Date(x.paid_at).toLocaleDateString("es") : ""}` : x.due_date < new Date().toISOString().slice(0, 10) ? "Vencido" : "Pendiente"}</td>
                      <td style={{ textAlign: "right" }}>{money(Number(x.amount), x.currency)}</td>
                    </tr>
                  ))}
                  <tr className="tot"><td colSpan={3}>Pagado</td><td style={{ textAlign: "right" }}>{money(st.paid, st.currency)}</td></tr>
                  <tr className="tot due"><td colSpan={3}>Saldo por pagar</td><td style={{ textAlign: "right" }}>{money(st.pending + st.overdue, st.currency)}</td></tr>
                </tbody>
              </table>
            )}

            <p className="note" style={{ marginTop: 22 }}>
              {st.pending + st.overdue > 0
                ? `Para pagar, escríbenos${WHATSAPP ? ` por WhatsApp al +591 ${WHATSAPP.startsWith("591") ? WHATSAPP.slice(3) : WHATSAPP}` : ""}. Si el cobro del período vence y no se registra, al día siguiente se suspende el acceso del equipo; los cupos de alumnos nuevos se activan al pagarse.`
                : "Gracias: no hay saldo pendiente este mes."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
