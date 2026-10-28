import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { DEMO_EMAIL, DEMO_ENABLED, DEMO_PASSWORD } from "../../lib/demo";
import { paths } from "../../routes/paths";
import "./landing.css";

/**
 * Página de presentación: lo que ve alguien que entra a FuerzaLab sin
 * haber iniciado sesión. Su trabajo es que un entrenador o un estudio
 * pruebe la demo o escriba por WhatsApp.
 *
 * Lo central es el panel de Novedades de la portada: funciona como en la
 * app (se puede marcar cada novedad como atendida), así se entiende en
 * segundos qué hace FuerzaLab por el entrenador cada mañana.
 */

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? "").trim();
const waLink = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

interface PublicPlan {
  name: string;
  client_limit: number | null;
  trainer_limit: number | null;
  price: number;
  currency: string;
  billing_period: "monthly" | "quarterly" | "annual";
}
const PERIOD: Record<PublicPlan["billing_period"], string> = { monthly: "al mes", quarterly: "por trimestre", annual: "al año" };

const SAMPLE_FEED = [
  { id: 1, tone: "ok", kind: "Récord", who: "Diego", when: "hoy", text: "2 récords nuevos: Sentadilla y Press de banca", detail: "Sentadilla: 130 kg × 6, 1RM est. 156 kg (+4%)" },
  { id: 2, tone: "bad", kind: "Bienestar", who: "Andrés", when: "hoy", text: "Bienestar 🔴 56/100", detail: "Dolor: rodilla derecha · “Dormí mal y me duele al bajar escaleras.”" },
  { id: 3, tone: "warn", kind: "Comentario", who: "Lucía", when: "ayer", text: "Terminó Cuerpo completo con esfuerzo muy bajo", detail: "“Me quedó liviano, ¿subimos un poco el peso?” · RPE 4/10" },
  { id: 4, tone: "pri", kind: "Medidas", who: "Camila", when: "ayer", text: "Cargó nuevas medidas", detail: "Peso 54,6 kg (−3,4 kg) · 2 circunferencias" },
] as const;

const AUDIENCES = {
  trainer: {
    tab: "Entrenadores",
    title: "Menos planillas, más tiempo con tus alumnos",
    points: [
      "Armas el programa una vez — mesociclos, semanas, biseries, notas por serie — y cada alumno lo ve en su celular, el día que le toca.",
      "Cuando terminan, ves qué series hicieron, con qué carga y cómo se sintieron. Los récords y las alertas te llegan solos.",
      "Evaluaciones completas (composición corporal con fórmula Navy, pliegues, fuerza, movilidad) y reportes en PDF con tu marca.",
      "Pagos, vencimientos y agenda en el mismo lugar.",
    ],
  },
  studio: {
    tab: "Estudios y gimnasios",
    title: "Todo tu equipo trabajando con el mismo método",
    points: [
      "Suma asistentes y decide qué ve cada uno: solo sus alumnos asignados, con o sin acceso a pagos y a datos de salud.",
      "Plantillas de programas y rutinas compartidas por todo el equipo.",
      "La app lleva la marca de tu estudio junto a FuerzaLab, en el celular de cada alumno y en cada reporte.",
    ],
  },
  client: {
    tab: "Tus alumnos",
    title: "Una app que dan ganas de abrir",
    points: [
      "La rutina de hoy, lo primero que ven: con la demostración de cada ejercicio y el temporizador de descanso.",
      "Cuando superan una marca, la app lo celebra con ellos.",
      "Su progreso en fotos, medidas y gráficos — y un chat directo contigo.",
      "Se instala en el celular como cualquier app, sin pasar por la tienda.",
    ],
  },
} as const;
type Audience = keyof typeof AUDIENCES;

const FEATURES: [string, string][] = [
  ["Planificación", "Programas por mesociclos y semanas, plantillas reutilizables y progresión automática sugerida."],
  ["Entrenamiento", "Cada serie registrada con carga, repeticiones y esfuerzo; también lo puedes cargar tú en la sesión presencial."],
  ["Evaluaciones", "Composición corporal, circunferencias, pliegues, fuerza, potencia, resistencia, movilidad y fotos en el mismo registro."],
  ["Bienestar", "Un cuestionario corto antes de entrenar, con semáforo para ajustar la carga del día."],
  ["Reportes", "La evolución de cada alumno en gráficos, con 1RM estimado por ejercicio, listos para exportar en PDF."],
  ["Negocio", "Planes, pagos, vencimientos y agenda presencial u online."],
];

/**
 * Video de 1 minuto: horizontal en pantallas anchas, vertical en celular.
 * preload="none": no se descarga nada hasta que el visitante toca play
 * (cuida el tráfico del hosting). Los subtítulos van incrustados.
 */
function DemoVideo() {
  const [vertical, setVertical] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 640px)");
    if (!mq) return;
    const on = () => setVertical(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return (
    <video
      key={vertical ? "v" : "h"}
      className={`lp-video${vertical ? " vertical" : ""}`}
      controls
      playsInline
      preload="none"
      poster={vertical ? "/video/poster-vertical.jpg" : "/video/poster.jpg"}
    >
      <source src={vertical ? "/video/fuerzalab-demo-vertical.mp4" : "/video/fuerzalab-demo.mp4"} type="video/mp4" />
    </video>
  );
}

export default function Landing() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<number[]>(SAMPLE_FEED.map((f) => f.id));
  const [audience, setAudience] = useState<Audience>("trainer");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [demoState, setDemoState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    supabase
      .rpc("public_platform_plans")
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) setPlans(data as PublicPlan[]);
      });
  }, []);

  const enterDemo = async () => {
    if (!DEMO_ENABLED) {
      navigate(paths.login);
      return;
    }
    setDemoState("loading");
    const { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (error) {
      setDemoState("error");
      return;
    }
    navigate("/", { replace: true });
  };

  const demoLabel = demoState === "loading" ? "Entrando a la demo…" : "Probar la demo";
  const shownFeed = SAMPLE_FEED.filter((f) => feed.includes(f.id));
  const a = AUDIENCES[audience];

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-top-row">
          <div className="lp-brand">
            <img src="/logo.png" alt="" width={34} height={34} />
            <span>
              Fuerza<b>Lab</b>
            </span>
          </div>
          <nav className="lp-top-actions">
            <Link to={paths.login} className="lp-link">Iniciar sesión</Link>
            {DEMO_ENABLED && (
              <button className="lp-btn lp-btn-small" onClick={enterDemo} disabled={demoState === "loading"}>
                {demoLabel}
              </button>
            )}
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <h1>Tus alumnos entrenan. FuerzaLab te dice qué atender.</h1>
            <p className="lp-lead">
              Rutinas, evaluaciones, bienestar, pagos y reportes para entrenadores personales y estudios. Tus alumnos la usan
              desde el celular, con tu marca.
            </p>
            <div className="lp-ctas">
              <button className="lp-btn" onClick={enterDemo} disabled={demoState === "loading"}>
                {demoLabel}
              </button>
              {WHATSAPP && (
                <a className="lp-btn lp-btn-ghost" href={waLink("Hola, quiero saber más sobre FuerzaLab.")} target="_blank" rel="noreferrer">
                  Escribir por WhatsApp
                </a>
              )}
            </div>
            {demoState === "error" && <p className="lp-error">La demo no está disponible en este momento. Intenta de nuevo en unos minutos.</p>}
            {DEMO_ENABLED && <p className="lp-fine">La demo entra a un entrenador con 8 alumnos y dos meses de datos. Sin registrarte.</p>}
          </div>

          <div className="lp-feed" aria-label="Ejemplo del panel de novedades">
            <div className="lp-feed-head">
              <span>Novedades</span>
              <span className="lp-feed-count">{shownFeed.length}</span>
            </div>
            {shownFeed.length === 0 ? (
              <div className="lp-feed-done">
                <div className="lp-feed-check">✓</div>
                <b>Todo al día</b>
                <p>Así se siente empezar el día con FuerzaLab.</p>
                <button className="lp-btn lp-btn-small" onClick={enterDemo}>Ver la demo completa</button>
                <button className="lp-link lp-reset" onClick={() => setFeed(SAMPLE_FEED.map((f) => f.id))}>Volver a ver las novedades</button>
              </div>
            ) : (
              shownFeed.map((f) => (
                <div key={f.id} className="lp-feed-item">
                  <div className="lp-feed-body">
                    <div className="lp-feed-meta">
                      <span className={`lp-chip ${f.tone}`}>{f.kind}</span>
                      <b>{f.who}</b>
                      <span className="lp-muted">{f.when}</span>
                    </div>
                    <div>{f.text}</div>
                    <div className="lp-muted lp-small">{f.detail}</div>
                  </div>
                  <button className="lp-attend" onClick={() => setFeed((xs) => xs.filter((x) => x !== f.id))}>
                    ✓ Atendida
                  </button>
                </div>
              ))
            )}
            {shownFeed.length > 0 && <p className="lp-feed-hint">Prueba marcarlas como atendidas.</p>}
          </div>
        </div>
      </section>

      <section className="lp-section lp-video-section">
        <div className="lp-wrap">
          <h2>FuerzaLab en 1 minuto</h2>
          <DemoVideo />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <h2>Pensada para cada uno</h2>
          <div className="lp-tabs" role="tablist">
            {(Object.keys(AUDIENCES) as Audience[]).map((k) => (
              <button key={k} role="tab" aria-selected={audience === k} className={audience === k ? "on" : ""} onClick={() => setAudience(k)}>
                {AUDIENCES[k].tab}
              </button>
            ))}
          </div>
          <div className="lp-audience" role="tabpanel">
            <h3>{a.title}</h3>
            <ul>
              {a.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-alt">
        <div className="lp-wrap">
          <h2>Todo lo que necesitas para acompañar a un alumno</h2>
          <dl className="lp-features">
            {FEATURES.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="lp-section" id="planes">
          <div className="lp-wrap">
            <h2>Planes</h2>
            <p className="lp-muted" style={{ marginTop: -8 }}>Elige según la cantidad de alumnos que acompañas. Todas las funciones están en todos los planes.</p>
            <div className="lp-plans">
              {plans.map((p, i) => (
                <div key={p.name} className={`lp-plan${i === Math.min(1, plans.length - 1) && plans.length > 1 ? " featured" : ""}`}>
                  <div className="lp-plan-name">{p.name}</div>
                  <div className="lp-plan-price">
                    {p.currency} {Number(p.price).toLocaleString("es")}
                    <span> {PERIOD[p.billing_period] ?? ""}</span>
                  </div>
                  <ul>
                    <li>{p.client_limit ? `Hasta ${p.client_limit} alumnos` : "Alumnos ilimitados"}</li>
                    <li>{p.trainer_limit ? (p.trainer_limit === 1 ? "1 entrenador" : `Hasta ${p.trainer_limit} entrenadores`) : "Entrenadores ilimitados"}</li>
                    <li>Todas las funciones incluidas</li>
                  </ul>
                  {WHATSAPP ? (
                    <a className="lp-btn lp-btn-ghost lp-btn-block" href={waLink(`Hola, me interesa el plan ${p.name} de FuerzaLab.`)} target="_blank" rel="noreferrer">
                      Quiero este plan
                    </a>
                  ) : (
                    <button className="lp-btn lp-btn-ghost lp-btn-block" onClick={enterDemo}>Probar la demo</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="lp-close">
        <div className="lp-wrap lp-close-row">
          <div>
            <h2>Mira FuerzaLab en acción</h2>
            <p>La demo no pide registro: entras como entrenador, con alumnos, récords, evaluaciones y pagos de ejemplo.</p>
          </div>
          <div className="lp-ctas">
            <button className="lp-btn lp-btn-light" onClick={enterDemo} disabled={demoState === "loading"}>
              {demoLabel}
            </button>
            {WHATSAPP && (
              <a className="lp-btn lp-btn-outline-light" href={waLink("Hola, quiero saber más sobre FuerzaLab.")} target="_blank" rel="noreferrer">
                Escribir por WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <span>© {new Date().getFullYear()} FuerzaLab</span>
          <span className="lp-foot-links">
            {EMAIL && <a href={`mailto:${EMAIL}`}>{EMAIL}</a>}
            <Link to={paths.login}>Iniciar sesión</Link>
            <Link to={paths.register}>Tengo un código de invitación</Link>
            <Link to={paths.privacy}>Privacidad</Link>
            <Link to={paths.terms}>Términos</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
