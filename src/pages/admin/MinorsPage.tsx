import { useEffect, useMemo, useState } from "react";
import Loading from "../../components/ui/Loading";
import WhatsAppButton from "../../components/WhatsAppButton";
import { useToast } from "../../contexts/ToastContext";
import { ageFrom } from "../../lib/minors";
import { consentDocUrl, fetchMinorsOverview, type MinorOverviewRow } from "../../services/adminMinors";

type Tab = "pending" | "ok" | "nodate";

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const daysLabel = (d: number) => (d === 0 ? "hoy" : d === 1 ? "hace 1 día" : `hace ${d} días`);
const first = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] || "";

/**
 * Super Admin → Menores de edad: qué entrenadores tienen alumnos menores,
 * si subieron la autorización del tutor (y verla), y qué alumnos no tienen
 * fecha de nacimiento (no se puede saber si son menores).
 */
export default function MinorsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<MinorOverviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("pending");

  useEffect(() => {
    fetchMinorsOverview()
      .then(setRows)
      .catch((e) => {
        setError(e.message);
        setRows([]);
      });
  }, []);

  const groups = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((r) => r.is_minor && !r.consent_at),
      ok: all.filter((r) => r.consent_at),
      nodate: all.filter((r) => !r.birth_date),
    };
  }, [rows]);

  const list = groups[tab];
  const byOrg = useMemo(() => {
    const m = new Map<string, MinorOverviewRow[]>();
    for (const r of list) {
      const k = `${r.organization_id}|${r.trainer_id}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.values()];
  }, [list]);

  const open = async (path: string) => {
    // La pestaña se abre antes de esperar el enlace, para que el navegador no la bloquee.
    const w = window.open("", "_blank");
    try {
      const url = await consentDocUrl(path);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      w?.close();
      notify(e.message ?? "No se pudo abrir la autorización.");
    }
  };

  const tabs: { id: Tab; label: string; count: number; tone: string }[] = [
    { id: "pending", label: "Sin autorización", count: groups.pending.length, tone: "var(--bad)" },
    { id: "ok", label: "Con autorización", count: groups.ok.length, tone: "var(--ok)" },
    { id: "nodate", label: "Sin fecha de nacimiento", count: groups.nodate.length, tone: "var(--warn)" },
  ];

  const message = (trainer: string | null, items: MinorOverviewRow[]) => {
    const names = items.map((r) => r.client_name).join(", ");
    if (tab === "pending")
      return `¡Hola ${first(trainer)}! Te escribo de FuerzaLab. En tu lista hay ${items.length === 1 ? "un alumno menor de edad" : "alumnos menores de edad"} sin la autorización firmada de su tutor: ${names}. Mientras falte, su ficha queda bloqueada. Puedes descargar la autorización desde su ficha en Clientes, hacerla firmar y subir la foto. ¡Gracias!`;
    if (tab === "nodate")
      return `¡Hola ${first(trainer)}! Te escribo de FuerzaLab. ${items.length === 1 ? "Este alumno no tiene" : "Estos alumnos no tienen"} fecha de nacimiento cargada: ${names}. ¿Me confirmas que son mayores de 18 años? Si alguno es menor, necesitamos la autorización firmada de su tutor. ¡Gracias!`;
    return `¡Hola ${first(trainer)}! Te escribo de FuerzaLab por la autorización del tutor de ${names}.`;
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Menores de edad</h1>
      <p className="note" style={{ marginBottom: 18, maxWidth: 720 }}>
        Alumnos menores de 18 años de cada entrenador y si ya subieron la autorización firmada de su tutor. Mientras falte, la
        ficha del menor queda bloqueada: no puede usar la app y no se le pueden cargar entrenamientos, evaluaciones, medidas
        ni fotos. Abre cada autorización para verificar que sea la hoja firmada.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="btn ghost"
            style={{
              borderColor: tab === t.id ? "var(--pri)" : "var(--line)",
              background: tab === t.id ? "var(--pri-soft)" : "#fff",
              fontWeight: tab === t.id ? 700 : 500,
            }}
          >
            {t.label}
            <span style={{ marginLeft: 6, color: t.count ? t.tone : "var(--muted)", fontWeight: 700 }}>{rows ? t.count : "…"}</span>
          </button>
        ))}
      </div>

      {tab === "nodate" && (
        <p className="note" style={{ marginBottom: 14, maxWidth: 720 }}>
          Sin fecha de nacimiento no se puede saber si son menores. Lo normal es que sean alumnos que todavía no completaron su
          formulario de ingreso (ahí la fecha es obligatoria). «Edad confirmada» indica que el entrenador marcó, al cargarlo,
          que es mayor de edad o que pedirá la autorización.
        </p>
      )}

      {!rows && <Loading />}
      {error && <p className="error-text">{error}</p>}
      {rows && !error && list.length === 0 && (
        <p className="note">{tab === "pending" ? "No hay menores sin autorización. 👍" : tab === "ok" ? "Todavía no hay autorizaciones subidas." : "Todos los alumnos tienen fecha de nacimiento."}</p>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {byOrg.map((items) => {
          const h = items[0];
          return (
            <div key={`${h.organization_id}|${h.trainer_id}`} className="panel">
              <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{h.organization_name}</h3>
                  <span className="note">Entrenador: {h.trainer_name || "—"}{h.trainer_phone ? ` · ${h.trainer_phone}` : ""}</span>
                </div>
                {tab !== "ok" && <WhatsAppButton small phone={h.trainer_phone} label="Avisar al entrenador" text={message(h.trainer_name, items)} />}
              </div>
              <div className="bd" style={{ display: "grid", gap: 10 }}>
                {items.map((r) => {
                  const age = ageFrom(r.birth_date);
                  return (
                    <div key={r.client_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <span>
                        <b>{r.client_name}</b>
                        {age != null && <span className="note"> · {age} años</span>}
                        <div className="note" style={{ fontSize: 12.5 }}>
                          {tab === "pending" && <>Cargado {daysLabel(daysSince(r.client_created_at))} · {r.has_account ? "tiene cuenta" : "sin cuenta todavía"}</>}
                          {tab === "ok" && <>Autorización subida el {new Date(r.consent_at!).toLocaleDateString("es")} · fotos de progreso: {r.photos_ok ? "autorizadas" : "no autorizadas"}</>}
                          {tab === "nodate" && (
                            <>
                              Cargado {daysLabel(daysSince(r.client_created_at))} · {r.form_submitted_at ? "formulario enviado" : r.has_account ? "no completó el formulario" : "todavía no creó su cuenta"}
                            </>
                          )}
                        </div>
                      </span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {tab === "pending" && (
                          <span className={`chip ${daysSince(r.client_created_at) > 7 ? "bad" : "warn"}`}>
                            {daysSince(r.client_created_at) > 7 ? "Más de 7 días" : "Pendiente"}
                          </span>
                        )}
                        {tab === "nodate" && (
                          <span className={`chip ${r.age_confirmed_at ? "ok" : ""}`}>{r.age_confirmed_at ? "Edad confirmada" : "Sin confirmar"}</span>
                        )}
                        {tab === "ok" && r.consent_path && (
                          <button type="button" className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => open(r.consent_path!)}>
                            Ver autorización
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
