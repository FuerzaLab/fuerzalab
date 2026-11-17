import { useEffect, type ReactNode } from "react";
import { LEGAL_PROVIDER } from "../../lib/minors";
import { LEGAL_UPDATED, LEGAL_VERSION } from "../../lib/legalVersion";
import { Link, useLocation } from "react-router-dom";
import { paths } from "../../routes/paths";
import "./landing.css";

/**
 * Términos de uso y Política de privacidad (páginas públicas).
 * Texto revisado con la abogada (versión corregida v2, noviembre de 2026),
 * con los agregados sobre menores de edad. Si cambia algo: actualizar
 * LEGAL.updated y LEGAL.version (la versión queda guardada al registrarse).
 */
export const LEGAL = {
  owner: LEGAL_PROVIDER.name,
  address: "Condominio El Rincón de la Hacienda, casa Nº 18, zona Norte, Santa Cruz de la Sierra – Bolivia",
  email: LEGAL_PROVIDER.email,
  updated: LEGAL_UPDATED,
  version: LEGAL_VERSION,
};
const contact = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

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

export function TermsPage() {
  return (
    <Shell title="Términos de uso">
      <p>
        Estos términos regulan el uso de FuerzaLab. Para usar la aplicación debes leerlos y aceptarlos, junto con la{" "}
        <Link to={paths.privacy}>Política de privacidad</Link>. Si no estás de acuerdo con ellos, no uses FuerzaLab.
      </p>

      <h2>1. Quién presta el servicio</h2>
      <p>
        FuerzaLab es un servicio prestado por {LEGAL.owner}, con domicilio en {LEGAL.address} (en adelante, “FuerzaLab”).
        Correo de contacto: {contact}. Dirección oficial de la aplicación: fuerzala.netlify.app. Si FuerzaLab cambia de
        titular o pasa a ser prestado por una empresa, te avisaremos dentro de la app.
      </p>

      <h2>2. Qué es FuerzaLab</h2>
      <p>
        Una plataforma para que entrenadores y estudios planifiquen el entrenamiento de sus alumnos, registren sus sesiones,
        evaluaciones, bienestar y pagos, y se comuniquen con ellos. Los alumnos acceden por invitación de su entrenador.
        FuerzaLab es una herramienta: no presta servicios de entrenamiento ni de salud.
      </p>

      <h2>3. Etapa de prueba</h2>
      <p>
        FuerzaLab se encuentra en etapa de prueba. Durante esta etapa, que durará aproximadamente dos meses, se invita a
        entrenadores a usar la app y a enviar sus observaciones y las de sus alumnos para mejorarla. Durante la etapa de prueba:
      </p>
      <ul>
        <li>Cada entrenador invitado tiene 30 días de prueba gratuita, sin límite de alumnos. El entrenador elige con qué alumnos realiza la prueba, y el uso también es gratuito para ellos.</li>
        <li>El acceso de los alumnos que participan en la prueba termina cuando termina la prueba de su entrenador. Si el alumno decide continuar, sus datos se conservan y pasa a las condiciones del punto 8; si no, sus datos se eliminan dentro de los 30 días siguientes.</li>
        <li>La aplicación puede tener errores, cambios de funciones o interrupciones.</li>
        <li>Antes de empezar a cobrar, te avisaremos dentro de la app con al menos 15 días de anticipación, indicando los planes y precios. Si no deseas continuar, puedes dejar de usarla sin ningún costo.</li>
      </ul>

      <h2>4. FuerzaLab no da indicaciones médicas</h2>
      <p>
        Las rutinas, cargas y recomendaciones las define tu entrenador, no FuerzaLab. Los cálculos que muestra la app (por
        ejemplo, el 1RM estimado, el porcentaje de grasa corporal o las sugerencias de progresión) son estimaciones de
        apoyo, no diagnósticos. El cuestionario PAR-Q+ ayuda a detectar señales de riesgo, pero no reemplaza una consulta
        médica: si respondes “Sí” a alguna pregunta o tienes dudas sobre tu salud, consulta a un médico antes de entrenar.
        Si sientes dolor, mareo o malestar durante un entrenamiento, detente y busca atención.
      </p>

      <h2>5. Cuentas y aceptación</h2>
      <ul>
        <li>Debes dar datos verdaderos y completos, en especial tu fecha de nacimiento y tus datos de salud, y mantener tu contraseña en reserva. Eres responsable de lo que se haga con tu cuenta.</li>
        <li>Al registrarte aceptas estos Términos y la Política de privacidad. Además, das un consentimiento separado y expreso para el registro de tus datos de salud y para que tus datos se guarden en servidores fuera de Bolivia.</li>
        <li>FuerzaLab guarda la fecha, la hora y la versión de los documentos que aceptaste.</li>
      </ul>

      <h2>6. Menores de edad</h2>
      <ul>
        <li>Cada entrenador define con qué edades trabaja. Los alumnos menores de 18 años solo pueden usar FuerzaLab con la autorización escrita de su madre, padre o tutor.</li>
        <li>Mientras la autorización firmada no esté cargada en la app y verificada por el entrenador, el menor no puede usar la aplicación, y no se le pueden registrar entrenamientos, evaluaciones, medidas ni fotos.</li>
        <li>En el caso de los menores, quien acepta estos Términos, contrata el plan y realiza los pagos es su madre, padre o tutor.</li>
        <li>La madre, padre o tutor puede ejercer en nombre del menor todos los derechos de la Política de privacidad, y puede leer en cualquier momento los mensajes entre el menor y su entrenador mediante un enlace privado de solo lectura que le envía el entrenador.</li>
      </ul>

      <h2>7. Obligaciones del entrenador o estudio</h2>
      <p>El entrenador o estudio que usa FuerzaLab con sus alumnos se compromete a:</p>
      <ul>
        <li>Usar los datos de sus alumnos solo para planificar y acompañar su entrenamiento, y mantenerlos en reserva.</li>
        <li>Verificar la edad de cada alumno y confirmarla en la app al cargarlo. Si el alumno es menor, conseguir la autorización firmada de su madre, padre o tutor antes de cargarle cualquier dato, y verificar que sea auténtica antes de habilitarlo. Es responsable de esa verificación. FuerzaLab puede revisar las autorizaciones cargadas y suspender la cuenta del entrenador o estudio que no cumpla con este punto.</li>
        <li>Dar acceso a sus asistentes solo a las secciones que necesiten, y responder por el uso que ellos hagan de los datos.</li>
        <li>No publicar ni compartir fotos, datos o resultados de sus alumnos, en redes sociales, publicidad u otros medios, sin su autorización escrita (o la de su madre, padre o tutor, si es menor).</li>
        <li>No descargar ni guardar fuera de la app los datos de salud o las autorizaciones firmadas de sus alumnos, salvo que sea necesario y por el tiempo indispensable.</li>
        <li>Avisar a FuerzaLab de inmediato si sospecha que alguien accedió a su cuenta o a los datos de sus alumnos sin autorización.</li>
      </ul>

      <h2>8. Planes, precios y pagos</h2>
      <ul>
        <li>El uso de FuerzaLab es gratuito para los entrenadores y estudios.</li>
        <li>Una vez concluida la etapa de prueba, cada alumno nuevo tendrá 30 días de uso gratuito, contados desde su registro. Vencido ese plazo, pagará directamente a FuerzaLab el plan que elija (mensual, trimestral, semestral o anual). Los planes y precios vigentes se informan dentro de la app.</li>
        <li>El pago se realiza mediante QR, a la cuenta bancaria a nombre de {LEGAL.owner} que se indica en la app. El comprobante del QR y el registro del pago en la app sirven de constancia del pago.</li>
        <li>FuerzaLab puede habilitar otros medios de pago, avisando dentro de la app.</li>
        <li>Si FuerzaLab cambia los precios, lo avisará con al menos 30 días de anticipación. El cambio se aplicará desde el siguiente período de pago; el período ya pagado se respeta.</li>
        <li>Los pagos que los alumnos hacen a su entrenador por el entrenamiento son un acuerdo entre ellos. FuerzaLab solo ofrece la herramienta para registrarlos y no interviene en ese cobro.</li>
      </ul>

      <h2>9. Devoluciones</h2>
      <p>
        No se devuelven los montos pagados si el alumno decide dejar de usar la app antes de que termine el período pagado.
        Sin embargo, si FuerzaLab suspende o cierra el servicio por causas que no sean imputables al alumno, devolverá la
        parte proporcional del período pagado y no utilizado.
      </p>

      <h2>10. Falta de pago y suspensión</h2>
      <ul>
        <li>FuerzaLab avisará al alumno dentro de la app 5 días antes del vencimiento de su período gratuito o de su plan.</li>
        <li>Si el pago no se realiza dentro de los 7 días siguientes al vencimiento, se suspende el acceso del alumno a la app.</li>
        <li>Durante la suspensión, los datos del alumno se conservan y el entrenador mantiene el acceso a sus datos de salud durante 30 días, para que el entrenamiento presencial siga siendo seguro. Pasado ese plazo, el entrenador deja de verlos hasta que el alumno pague.</li>
        <li>Al pagar, el acceso se reactiva con todo el historial. Si la suspensión dura más de 6 meses, los datos se eliminan, previo aviso al alumno.</li>
      </ul>

      <h2>11. Uso aceptable</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Acceder a cuentas o datos de otras personas sin autorización, o intentar vulnerar la seguridad de la plataforma.</li>
        <li>Cargar contenido ilegal u ofensivo, o fotos, videos y textos que no te pertenecen y que no tienes permiso para usar (por ejemplo, videos de ejercicios descargados de internet). Si recibimos un reclamo fundado por derechos de autor, podemos retirar ese contenido.</li>
        <li>Usar la plataforma para enviar publicidad no solicitada o para fines distintos del acompañamiento del entrenamiento.</li>
      </ul>

      <h2>12. Suspensión por incumplimiento y baja</h2>
      <p>
        Puedes dejar de usar FuerzaLab cuando quieras. FuerzaLab puede suspender o cerrar una cuenta que incumpla estos
        términos, avisando con al menos 5 días de anticipación, salvo que el incumplimiento sea grave o ponga en riesgo la
        seguridad de otros usuarios (por ejemplo, cargar datos de menores sin la autorización de su tutor), en cuyo caso
        podrá hacerlo de inmediato. Si un entrenador o estudio se da de baja, puede pedir una copia de sus datos dentro de
        los 30 días siguientes; vencido ese plazo, los datos se eliminan.
      </p>

      <h2>13. Disponibilidad</h2>
      <p>
        Trabajamos para que FuerzaLab esté siempre disponible, pero puede haber interrupciones por mantenimiento o por fallas
        de los proveedores técnicos. Recomendamos no depender de la app como único registro de información crítica.
      </p>

      <h2>14. Responsabilidad</h2>
      <p>
        FuerzaLab no es responsable por lesiones o daños derivados de los entrenamientos, que son responsabilidad del
        entrenador que los indica y del alumno que los realiza, ni por decisiones tomadas en base a las estimaciones de la
        app. En la medida que lo permita la ley, la responsabilidad de FuerzaLab frente a un usuario se limita al monto que
        ese usuario le pagó en los últimos 12 meses. Esta limitación no se aplica a los daños causados por dolo o culpa grave
        de FuerzaLab.
      </p>

      <h2>15. Propiedad intelectual y contenido</h2>
      <p>
        La plataforma, su diseño, su código y su marca son de FuerzaLab. Los datos que cargan los entrenadores y alumnos son
        de ellos; FuerzaLab solo los usa para prestar el servicio. Al cargar contenido, autorizas a FuerzaLab a guardarlo y
        mostrarlo dentro de la app únicamente para ese fin. Las sugerencias que nos envíes para mejorar la app pueden ser
        usadas libremente por FuerzaLab, sin que generen pagos ni derechos a tu favor.
      </p>

      <h2>16. Cambios a estos términos</h2>
      <p>
        Si cambiamos estos términos, actualizaremos la fecha de arriba y te avisaremos dentro de la app con al menos 15 días
        de anticipación. Si no estás de acuerdo con los cambios, puedes dejar de usar FuerzaLab. Si los cambios afectan el
        uso de tus datos de salud, te pediremos un nuevo consentimiento.
      </p>

      <h2>17. Ley aplicable y conflictos</h2>
      <p>
        Estos términos se rigen por las leyes del Estado Plurinacional de Bolivia. Ante cualquier conflicto, las partes
        intentarán primero resolverlo de forma directa y amistosa. Si no se llega a un acuerdo, serán competentes los
        juzgados de la ciudad de Santa Cruz de la Sierra.
      </p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Política de privacidad">
      <p>
        FuerzaLab es una plataforma para que entrenadores y estudios planifiquen, registren y acompañen el entrenamiento de
        sus alumnos. Esta política explica qué datos se guardan, para qué, quién los ve, dónde se guardan y qué derechos
        tienes. El servicio lo presta {LEGAL.owner}, en Santa Cruz de la Sierra – Bolivia (ver el punto 1 de los{" "}
        <Link to={paths.terms}>Términos de uso</Link>).
      </p>

      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        <b>Si eres alumno:</b> tus datos de entrenamiento y salud los carga y administra tu entrenador o estudio, que es el
        responsable de usarlos para acompañar tu entrenamiento. FuerzaLab actúa como el servicio que los guarda y procesa
        por cuenta de ellos. Los datos de tu cuenta y de los pagos de tu plan a FuerzaLab son responsabilidad de FuerzaLab.
      </p>
      <p>
        <b>Si eres entrenador, asistente o estudio:</b> FuerzaLab es responsable de los datos de tu cuenta (nombre, correo y
        uso de la plataforma).
      </p>

      <h2>2. Qué datos se guardan</h2>
      <ul>
        <li><b>Cuenta:</b> nombre, correo electrónico, teléfono (opcional), contraseña (guardada de forma protegida) y fecha del último ingreso.</li>
        <li><b>Formulario de ingreso:</b> fecha de nacimiento, sexo, estatura, peso, objetivos, historial deportivo, hábitos, preferencias de entrenamiento y contacto de emergencia. Si das los datos de un contacto de emergencia, declaras que esa persona está de acuerdo.</li>
        <li><b>Datos de salud:</b> respuestas al cuestionario PAR-Q+, lesiones o molestias, medicamentos, alergias o condiciones médicas, registros de bienestar (sueño, fatiga, energía, estrés, dolor) y evaluaciones físicas (medidas, composición corporal, pliegues, pruebas de fuerza, movilidad y otras).</li>
        <li><b>Entrenamiento:</b> rutinas, series, cargas, repeticiones, esfuerzo percibido y comentarios.</li>
        <li><b>Fotos de progreso</b> que subes tú o tu entrenador, solo si las autorizaste.</li>
        <li><b>Mensajes</b> entre el alumno y su entrenador o su equipo.</li>
        <li><b>Menores de edad:</b> datos de la madre, padre o tutor y la foto de la autorización firmada.</li>
        <li><b>Pagos:</b> planes, montos, fechas y estado de los pagos, tanto de tu plan a FuerzaLab como los que registra tu entrenador. FuerzaLab no guarda datos de tarjetas. Sí guarda la foto del comprobante de pago que subes, que puede mostrar el nombre de tu banco y parte de la cuenta desde la que pagaste.</li>
      </ul>
      <p>
        Los datos de salud son datos sensibles. Se piden solo para que el entrenamiento sea seguro y adecuado para ti, se
        registran únicamente con tu consentimiento expreso y se tratan con especial cuidado (ver el punto 6).
      </p>

      <h2>3. Para qué se usan</h2>
      <ul>
        <li>Que tu entrenador diseñe, ajuste y siga tu plan de entrenamiento.</li>
        <li>Mostrarte tu rutina, tu progreso y tus récords, y avisarle a tu entrenador de lo que necesita atención (por ejemplo, una alerta de bienestar).</li>
        <li>Generar reportes de progreso.</li>
        <li>Administrar los pagos de tu plan y avisarte de los vencimientos.</li>
        <li>Mantener la plataforma funcionando y segura, y dar soporte.</li>
      </ul>
      <p>Tus datos no se venden ni se usan para publicidad. No se comparten con terceros para fines propios de ellos.</p>

      <h2>4. Quién los ve</h2>
      <ul>
        <li>Tu entrenador y, si trabaja con asistentes, solo los asistentes a quienes él les dio permiso para esa sección (por ejemplo, un asistente puede no tener acceso a tus datos de salud ni a tus pagos).</li>
        <li>El dueño de un estudio ve resúmenes del trabajo de su equipo (cantidad de alumnos, asistencia, cobros), no tu ficha ni tus datos de salud.</li>
        <li>El administrador de FuerzaLab, que es una sola persona, solo cuando hace falta para dar soporte, mantener el servicio, confirmar los pagos de los planes o verificar las autorizaciones de los alumnos menores.</li>
        <li>Los proveedores técnicos que alojan la plataforma (ver el punto 5).</li>
        <li>Autoridades, solo si una ley o una orden judicial lo exige.</li>
      </ul>

      <h2>5. Dónde se guardan</h2>
      <p>
        La base de datos y los archivos (incluidas las fotos) se guardan en Supabase, en servidores ubicados en Estados
        Unidos (Virginia del Norte). La aplicación se publica a través de Netlify, que usa servidores en distintos países.
        Estos proveedores actúan por cuenta de FuerzaLab y no pueden usar los datos para otros fines. Al aceptar esta
        política, autorizas expresamente que tus datos se guarden fuera de Bolivia.
      </p>

      <h2>6. Cómo se protegen</h2>
      <ul>
        <li>La conexión con la app está cifrada (HTTPS) y las contraseñas se guardan de forma protegida.</li>
        <li>Cada organización tiene sus datos aislados: las reglas de la base de datos impiden que un entrenador vea los alumnos de otro, y que un alumno vea los datos de otro alumno.</li>
        <li>Las fotos de progreso, las autorizaciones firmadas y los comprobantes de pago se guardan en un almacenamiento privado y solo se muestran con enlaces temporales.</li>
        <li>Las cuentas con las que se administran los servidores de FuerzaLab están protegidas con verificación en dos pasos.</li>
        <li>Ningún sistema es 100% invulnerable. Si ocurriera un incidente que afecte tus datos, te lo informaremos sin demora, en un plazo máximo de 5 días desde que lo conozcamos, indicando qué pasó y qué medidas tomamos.</li>
      </ul>

      <h2>7. Cuánto tiempo se guardan</h2>
      <p>
        Mientras tengas una cuenta activa o tu entrenador te tenga como alumno. Si tu entrenador te da de baja, tu historial
        se conserva por 12 meses para que, si vuelves, no pierdas tu progreso; pasado ese plazo, se elimina. Si tu entrenador
        te elimina, se borra de forma definitiva tu ficha con todo lo que cuelga de ella (rutinas, registros, evaluaciones,
        fotos, mensajes y pagos). Las copias de respaldo técnicas del proveedor se eliminan automáticamente cuando vence su
        plazo. Puedes pedir la eliminación en cualquier momento (punto 8).
      </p>

      <h2>8. Tus derechos</h2>
      <p>En cualquier momento puedes pedir:</p>
      <ul>
        <li><b>Acceso:</b> saber qué datos tuyos están guardados y recibir una copia.</li>
        <li><b>Rectificación:</b> corregir datos incorrectos (muchos los puedes corregir tú mismo desde la app).</li>
        <li><b>Cancelación:</b> que se borren tus datos.</li>
        <li><b>Oposición:</b> que dejen de usarse para un fin determinado.</li>
        <li>Retirar tu consentimiento sobre los datos de salud o las fotos; en el caso de los datos de salud, tu entrenador puede no estar en condiciones de armarte un plan seguro.</li>
      </ul>
      <p>
        Escríbele a tu entrenador o a FuerzaLab al correo {contact}. Respondemos dentro de los 15 días hábiles. Si pides la
        eliminación, tus datos se borran dentro de ese mismo plazo. En Bolivia, la Constitución Política del Estado reconoce
        además la Acción de Protección de Privacidad.
      </p>

      <h2>9. Menores de edad</h2>
      <p>
        Para usar FuerzaLab como alumno siendo menor de 18 años hace falta la autorización escrita de tu madre, padre o
        tutor, cargada en la app y verificada por tu entrenador. Hasta entonces, no puedes usar la app y no se te pueden
        cargar entrenamientos, evaluaciones, medidas ni fotos. Ellos pueden ejercer los derechos del punto 8 en tu nombre y
        leer los mensajes con tu entrenador mediante un enlace privado de solo lectura.
      </p>

      <h2>10. Fotos de progreso</h2>
      <p>
        Las fotos de progreso son opcionales y solo se guardan si las autorizaste (o, si eres menor, si las autorizó tu
        madre, padre o tutor). Solo las ve tu entrenador, salvo las que tú subas y marques como «solo para mí»: esas no las ve
        nadie más (ni tu entrenador ni FuerzaLab), y puedes cambiarlo cuando quieras. No se publican en redes sociales, publicidad ni ningún otro medio
        sin otra autorización escrita.
      </p>

      <h2>11. Cookies y almacenamiento en el navegador</h2>
      <p>
        La app guarda en tu navegador solo la información necesaria para mantener tu sesión iniciada y recordar tus
        preferencias. No usa herramientas de analítica, publicidad ni rastreo de terceros.
      </p>

      <h2>12. Cambios a esta política</h2>
      <p>
        Si la cambiamos, actualizaremos la fecha de arriba y te avisaremos dentro de la app con al menos 15 días de
        anticipación. Si el cambio afecta el uso de tus datos de salud o el lugar donde se guardan, te pediremos un nuevo
        consentimiento.
      </p>
    </Shell>
  );
}
