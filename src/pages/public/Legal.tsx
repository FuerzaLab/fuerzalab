import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { paths } from "../../routes/paths";
import "./landing.css";

/**
 * Política de privacidad y Términos de uso (páginas públicas).
 *
 * ⚠ Es un borrador redactado con buenas prácticas internacionales; antes de
 * vender a estudios conviene que lo revise un abogado en Bolivia. Bolivia
 * todavía no tiene una ley general de protección de datos (a octubre de
 * 2026 hay un proyecto en tratamiento); la base actual es la Constitución
 * (Acción de Protección de Privacidad).
 *
 * Datos a completar: LEGAL.owner (nombre o razón social y NIT de quien
 * presta el servicio). El correo sale de VITE_CONTACT_EMAIL.
 */
export const LEGAL = {
  owner: "FuerzaLab", // ← reemplazar por el nombre o la razón social (y NIT) del responsable
  country: "Bolivia",
  updated: "27 de octubre de 2026",
};
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? "").trim();
const contact = EMAIL ? <a href={`mailto:${EMAIL}`}>{EMAIL}</a> : "el correo de contacto que figura en la página principal";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  // Al pasar de una página legal a la otra, empezar desde arriba.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const isPrivacy = pathname === paths.privacy;
  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-top-row">
          <Link to="/" className="lp-brand" style={{ textDecoration: "none" }}>
            <img src="/logo.png" alt="" width={34} height={34} />
            <span>
              Fuerza<b>Lab</b>
            </span>
          </Link>
          <nav className="lp-top-actions legal-nav">
            <Link to={paths.privacy} className="lp-link">Privacidad</Link>
            <Link to={paths.terms} className="lp-link">Términos</Link>
          </nav>
        </div>
      </header>
      <main className="lp-wrap legal">
        <h1>{title}</h1>
        <p className="lp-muted">Última actualización: {LEGAL.updated}</p>
        <p className="legal-switch">
          {isPrivacy ? (
            <>Ver también: <Link to={paths.terms}>Términos de uso</Link></>
          ) : (
            <>Ver también: <Link to={paths.privacy}>Política de privacidad</Link></>
          )}
        </p>
        {children}
      </main>
      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <span>© {new Date().getFullYear()} FuerzaLab</span>
          <span className="lp-foot-links">
            <Link to="/">Inicio</Link>
            <Link to={paths.privacy}>Privacidad</Link>
            <Link to={paths.terms}>Términos</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Política de privacidad">
      <p>
        FuerzaLab es una plataforma para que entrenadores y estudios planifiquen, registren y acompañen el entrenamiento de
        sus alumnos. Esta política explica qué datos se guardan, para qué, quién los ve y qué derechos tienes. La presta{" "}
        {LEGAL.owner}, en {LEGAL.country}.
      </p>

      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        <b>Si eres alumno:</b> tus datos los carga y administra tu entrenador o estudio, que es el responsable de usarlos
        para acompañar tu entrenamiento. FuerzaLab actúa como el servicio que los guarda y procesa por cuenta de ellos.
        Para consultas sobre cómo tu entrenador usa tu información, puedes escribirle directamente desde la app.
      </p>
      <p>
        <b>Si eres entrenador, asistente o estudio:</b> FuerzaLab es responsable de los datos de tu cuenta (nombre, correo,
        uso de la plataforma y los registros de pago de tu plan de FuerzaLab: plan contratado, montos, fechas y si está al día).
      </p>

      <h2>2. Qué datos se guardan</h2>
      <ul>
        <li><b>Cuenta:</b> nombre, correo electrónico, teléfono (opcional), contraseña (guardada cifrada) y fecha del último ingreso.</li>
        <li><b>Formulario de ingreso:</b> fecha de nacimiento, sexo, estatura, peso, objetivos, historial deportivo, hábitos, preferencias de entrenamiento y contacto de emergencia.</li>
        <li><b>Datos de salud:</b> respuestas al cuestionario PAR-Q+, lesiones o molestias, medicamentos, alergias o condiciones médicas, registros de bienestar (sueño, fatiga, energía, estrés, dolor) y evaluaciones físicas (medidas, composición corporal, pliegues, pruebas de fuerza, movilidad y otras).</li>
        <li><b>Entrenamiento:</b> rutinas, series, cargas, repeticiones, esfuerzo percibido y comentarios.</li>
        <li><b>Fotos de progreso</b> que subes tú o tu entrenador.</li>
        <li><b>Mensajes</b> entre el alumno y su entrenador o su equipo.</li>
        <li><b>Pagos:</b> planes, montos, fechas y estado de los pagos que registra el entrenador. FuerzaLab no guarda datos de tarjetas ni de cuentas bancarias.</li>
      </ul>
      <p>
        Los datos de salud son <b>datos sensibles</b>. Se piden solo para que el entrenamiento sea seguro y adecuado para ti,
        y se tratan con especial cuidado (ver punto 5).
      </p>

      <h2>3. Para qué se usan</h2>
      <ul>
        <li>Que tu entrenador diseñe, ajuste y siga tu plan de entrenamiento.</li>
        <li>Mostrarte tu rutina, tu progreso y tus récords, y avisarle a tu entrenador de lo que necesita atención (por ejemplo, una alerta de bienestar).</li>
        <li>Generar reportes de progreso.</li>
        <li>Administrar los pagos de tu plan.</li>
        <li>Mantener la plataforma funcionando y segura, y dar soporte.</li>
      </ul>
      <p>
        <b>Tus datos no se venden ni se usan para publicidad.</b> No se comparten con terceros para fines propios de ellos.
      </p>

      <h2>4. Quién los ve</h2>
      <ul>
        <li><b>Tu entrenador</b> y, si trabaja con asistentes, solo los asistentes a quienes él les dio permiso para esa sección (por ejemplo, un asistente puede no tener acceso a tus datos de salud ni a tus pagos).</li>
        <li><b>El dueño de un estudio</b> ve resúmenes del trabajo de su equipo (cantidad de alumnos, asistencia, cobros), no tu ficha ni tus datos de salud.</li>
        <li><b>El administrador de FuerzaLab</b>, solo cuando hace falta para dar soporte o mantener el servicio.</li>
        <li><b>Proveedores técnicos</b> que alojan la plataforma: la base de datos y los archivos se guardan en Supabase y la aplicación se publica en Netlify, con servidores fuera de Bolivia. Actúan por cuenta de FuerzaLab y no pueden usar los datos para otros fines.</li>
        <li><b>Autoridades</b>, solo si una ley o una orden judicial lo exige.</li>
      </ul>

      <h2>5. Cómo se protegen</h2>
      <ul>
        <li>La conexión con la app está cifrada (HTTPS) y las contraseñas se guardan cifradas.</li>
        <li>Cada organización tiene sus datos aislados: las reglas de la base de datos impiden que un entrenador vea los alumnos de otro, y que un alumno vea los datos de otro alumno.</li>
        <li>Las fotos de progreso se guardan en un almacenamiento privado y solo se muestran con enlaces temporales.</li>
        <li>Ningún sistema es 100% invulnerable; si ocurriera un incidente que afecte tus datos, te lo vamos a informar.</li>
      </ul>

      <h2>6. Cuánto tiempo se guardan</h2>
      <p>
        Mientras tengas una cuenta activa o tu entrenador te tenga como alumno. Si tu entrenador te da de baja, tu historial se
        conserva para que, si vuelves, no pierdas tu progreso; si te elimina por completo, se borra tu ficha con todo lo que
        cuelga de ella (rutinas, registros, evaluaciones, fotos, mensajes y pagos). Puedes pedir la eliminación en cualquier
        momento (punto 7).
      </p>

      <h2>7. Tus derechos</h2>
      <p>En cualquier momento puedes pedir:</p>
      <ul>
        <li><b>Acceso:</b> saber qué datos tuyos están guardados y recibir una copia.</li>
        <li><b>Rectificación:</b> corregir datos incorrectos (muchos los puedes corregir tú mismo desde la app).</li>
        <li><b>Cancelación:</b> que se borren tus datos.</li>
        <li><b>Oposición:</b> que dejen de usarse para un fin determinado.</li>
        <li><b>Retirar tu consentimiento</b> sobre los datos de salud; en ese caso, tu entrenador puede no estar en condiciones de armarte un plan seguro.</li>
      </ul>
      <p>
        Escríbele a tu entrenador o a FuerzaLab a {contact}. Respondemos dentro de los 15 días hábiles. En Bolivia, la
        Constitución Política del Estado reconoce además la Acción de Protección de Privacidad.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        Para usar FuerzaLab como alumno siendo menor de 18 años hace falta la autorización de tu madre, padre o tutor, que
        también puede ejercer los derechos del punto 7 en tu nombre.
      </p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Si la cambiamos, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos dentro de la app.
      </p>
    </Shell>
  );
}

export function TermsPage() {
  return (
    <Shell title="Términos de uso">
      <p>
        Estos términos regulan el uso de FuerzaLab, que presta {LEGAL.owner}. Al crear una cuenta, aceptas estos términos y
        la <Link to={paths.privacy}>Política de privacidad</Link>.
      </p>

      <h2>1. Qué es FuerzaLab</h2>
      <p>
        Una plataforma para que entrenadores y estudios planifiquen el entrenamiento de sus alumnos, registren sus sesiones,
        evaluaciones, bienestar y pagos, y se comuniquen con ellos. Los alumnos acceden por invitación de su entrenador.
      </p>

      <h2>2. FuerzaLab no da indicaciones médicas</h2>
      <p>
        Las rutinas, cargas y recomendaciones las define tu entrenador, no FuerzaLab. Los cálculos que muestra la app (por
        ejemplo, el 1RM estimado, el porcentaje de grasa corporal o las sugerencias de progresión) son estimaciones de
        apoyo, no diagnósticos. El cuestionario PAR-Q+ ayuda a detectar señales de riesgo, pero no reemplaza una consulta
        médica: si respondes "Sí" a alguna pregunta o tienes dudas sobre tu salud, consulta a un médico antes de entrenar.
        Si sientes dolor, mareo o malestar durante un entrenamiento, detente y busca atención.
      </p>

      <h2>3. Cuentas</h2>
      <ul>
        <li>Debes dar datos verdaderos y mantener tu contraseña en reserva. Eres responsable de lo que se haga con tu cuenta.</li>
        <li>Los alumnos menores de 18 años necesitan la autorización de su madre, padre o tutor.</li>
        <li>El entrenador o estudio es responsable de tener el consentimiento de sus alumnos para cargar sus datos, y de usarlos solo para acompañar su entrenamiento.</li>
      </ul>

      <h2>4. Planes y pagos</h2>
      <p>
        Los entrenadores y estudios pagan a FuerzaLab según el plan contratado. Los pagos que los alumnos hacen a su
        entrenador son un acuerdo entre ellos: FuerzaLab solo ofrece la herramienta para registrarlos y no interviene en
        el cobro.
      </p>

      <h2>5. Uso aceptable</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Acceder a cuentas o datos de otras personas sin autorización, o intentar vulnerar la seguridad de la plataforma.</li>
        <li>Cargar contenido ilegal, ofensivo o que no te pertenece.</li>
        <li>Usar la plataforma para enviar publicidad no solicitada o para fines distintos del acompañamiento del entrenamiento.</li>
      </ul>

      <h2>6. Suspensión y baja</h2>
      <p>
        Puedes dejar de usar FuerzaLab cuando quieras. Podemos suspender una cuenta que incumpla estos términos o que tenga
        pagos pendientes con la plataforma, avisando antes cuando sea posible. Si una organización se da de baja, puede
        pedir una copia de sus datos antes de que se eliminen.
      </p>

      <h2>7. Disponibilidad</h2>
      <p>
        Trabajamos para que FuerzaLab esté siempre disponible, pero puede haber interrupciones por mantenimiento o por fallas
        de los proveedores técnicos. Recomendamos no depender de la app como único registro de información crítica.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        FuerzaLab no es responsable por lesiones o daños derivados de los entrenamientos, que son responsabilidad del
        entrenador que los indica y del alumno que los realiza, ni por decisiones tomadas en base a las estimaciones de la
        app. En la medida que lo permita la ley, la responsabilidad de FuerzaLab se limita al monto pagado por el plan en
        los últimos tres meses.
      </p>

      <h2>9. Propiedad</h2>
      <p>
        La plataforma, su diseño y su marca son de FuerzaLab. Los datos que cargan los entrenadores y alumnos son de ellos;
        FuerzaLab solo los usa para prestar el servicio.
      </p>

      <h2>10. Cambios y ley aplicable</h2>
      <p>
        Si cambiamos estos términos, actualizaremos la fecha de arriba y avisaremos dentro de la app. Se rigen por las leyes
        del Estado Plurinacional de Bolivia. Consultas: {contact}.
      </p>
    </Shell>
  );
}
