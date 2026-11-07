import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { paths } from "../../routes/paths";
import PasswordInput from "../../components/ui/PasswordInput";

interface InvitePreview {
  valid: boolean;
  role: string;
  email: string | null;
  full_name: string | null;
  org_name: string;
}

export default function Register() {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(searchParams.get("codigo") ?? "");
  // Si el código vino en el enlace, no hace falta mostrar el campo (salvo que quiera cambiarlo).
  const codeFromLink = !!searchParams.get("codigo");
  const [editingCode, setEditingCode] = useState(false);
  // Entrenador invitado: días de prueba gratis de su organización (part4g).
  const [welcome, setWelcome] = useState<{ trial_days: number | null; trial_free_clients: number | null } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Verifica el código apenas el usuario termina de escribirlo (12
  // caracteres), para mostrarle de inmediato a qué organización se une.
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 8) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setCheckingCode(true);
    supabase
      .rpc("check_invitation", { p_code: trimmed })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        setCheckingCode(false);
        if (rpcError || !data || data.length === 0) {
          setPreview(null);
          return;
        }
        const row = data[0] as InvitePreview;
        setPreview(row);
        if (row.role === "trainer") {
          supabase.rpc("invitation_welcome", { p_code: trimmed }).then(({ data: w }) => {
            if (!cancelled && w && w.length) setWelcome(w[0] as any);
          });
        } else setWelcome(null);
        if (row.full_name && !fullName) setFullName(row.full_name);
        if (row.email && !email) setEmail(row.email);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError("Pega el código de invitación que te compartió tu entrenador o administrador.");
    if (!fullName.trim()) return setError("Escribe tu nombre completo.");
    if (!email.trim()) return setError("Escribe tu correo electrónico.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");
    if (!acceptTerms) return setError("Para crear tu cuenta tienes que aceptar los Términos de uso y la Política de privacidad.");

    setError("");
    setLoading(true);
    const { error: err } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      inviteCode: code.trim(),
    });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div>
        <h2 style={{ marginBottom: 6 }}>Revisa tu correo</h2>
        <p className="note" style={{ marginBottom: 16 }}>
          Te enviamos un enlace de confirmación a <b>{email}</b>. Ábrelo para activar tu cuenta y después vuelve aquí
          a iniciar sesión.
        </p>
        <Link to={paths.login} className="btn" style={{ width: "100%", justifyContent: "center" }}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  // Entrenadores y asistentes invitados: bienvenida propia, sin el texto de datos de salud (es para alumnos).
  const isTeam = !!preview && (preview.role === "trainer" || preview.role === "staff");
  const firstName = (fullName || preview?.full_name || "").trim().split(" ")[0];
  const showCodeField = !codeFromLink || editingCode || !preview;

  return (
    <form onSubmit={onSubmit}>
      {isTeam ? (
        <>
          <h2 style={{ marginBottom: 6 }}>{firstName ? `¡Hola, ${firstName}!` : "¡Te damos la bienvenida!"}</h2>
          <p className="note" style={{ marginBottom: welcome?.trial_days ? 12 : 20 }}>
            Te invitaron a <b style={{ color: "var(--ink)" }}>{preview!.org_name}</b> como {rolLabel(preview!.role)} en FuerzaLab.{" "}
            {preview!.role === "trainer"
              ? "Crea tu cuenta para armar los planes de tus alumnos y seguir su progreso."
              : "Crea tu cuenta para empezar."}
          </p>
          {welcome?.trial_days ? (
            <div className="welcome-trial">
              🎁 Tienes <b>{welcome.trial_days} {welcome.trial_days === 1 ? "día" : "días"} gratis</b> para probar la app
              {welcome.trial_free_clients ? ` con hasta ${welcome.trial_free_clients} alumnos` : ""}.
            </div>
          ) : null}
        </>
      ) : (
        <>
          <h2 style={{ marginBottom: 6 }}>Crear tu cuenta</h2>
          <p className="note" style={{ marginBottom: 20 }}>
            {preview ? (
              <>Te unirás a <b style={{ color: "var(--ink)" }}>{preview.org_name}</b>.</>
            ) : (
              "Necesitas el código de invitación que te compartieron."
            )}
          </p>
        </>
      )}

      {showCodeField ? (
        <>
          <label className="field-label" htmlFor="code">Código de invitación</label>
          <input
            id="code"
            className="input"
            style={{ marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXXXXXXXXXX"
            autoFocus={!codeFromLink}
          />
          {checkingCode && <p className="note" style={{ marginBottom: 10 }}>Comprobando código…</p>}
          {!checkingCode && preview && (
            <p className="note" style={{ marginBottom: 10, color: "var(--ok)" }}>
              Código válido. Te unirás a <b>{preview.org_name}</b> como {rolLabel(preview.role)}.
            </p>
          )}
        </>
      ) : (
        <p className="note" style={{ margin: "0 0 14px", fontSize: 13 }}>
          ✓ Invitación válida ·{" "}
          <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={() => setEditingCode(true)}>
            Cambiar código
          </button>
        </p>
      )}
      {!checkingCode && !preview && code.trim().length >= 8 && (
        <p className="error-text" style={{ marginBottom: 10 }}>No encontramos ese código, o ya venció.</p>
      )}

      <label className="field-label" htmlFor="fullName">Nombre completo</label>
      <input
        id="fullName"
        className="input"
        style={{ marginBottom: 14 }}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <label className="field-label" htmlFor="email">Correo electrónico</label>
      <input
        id="email"
        type="email"
        className="input"
        style={{ marginBottom: 14 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={Boolean(preview?.email)}
      />

      <label className="field-label" htmlFor="password">Contraseña</label>
      <PasswordInput
        id="password"
        style={{ marginBottom: 14 }}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      <label className="field-label" htmlFor="confirmPassword">Confirmar contraseña</label>
      <PasswordInput
        id="confirmPassword"
        style={{ marginBottom: 8 }}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "14px 0 4px", fontSize: 13.5 }}>
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          Acepto los{" "}
          <Link to={paths.terms} target="_blank" rel="noreferrer">Términos de uso</Link> y la{" "}
          <Link to={paths.privacy} target="_blank" rel="noreferrer">Política de privacidad</Link>
          {isTeam ? "." : ", incluido el uso de mis datos de salud para planificar mi entrenamiento."}
        </span>
      </label>

      {error && <p className="error-text" style={{ margin: "10px 0" }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} disabled={loading}>
        {loading ? "Creando tu cuenta…" : "Crear cuenta"}
      </button>

      <p className="note" style={{ marginTop: 20, textAlign: "center" }}>
        ¿Ya tienes cuenta? <Link to={paths.login}>Inicia sesión</Link>
      </p>
    </form>
  );
}

function rolLabel(role: string): string {
  if (role === "trainer") return "entrenador";
  if (role === "staff") return "asistente";
  if (role === "client") return "cliente";
  return role;
}
