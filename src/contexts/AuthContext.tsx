import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile, StaffAccess, StaffModule, StaffLevel } from "../types/auth";
import { hasLevel } from "../lib/staffModules";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** true una vez que ya sabemos con certeza si hay sesión o no */
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    inviteCode?: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  /** Solo para cuentas de staff: a qué entrenador asiste y con qué permisos. */
  staffAccess: StaffAccess | null;
  /**
   * El entrenador "dueño" de los datos con los que se está trabajando: el
   * propio perfil si sos entrenador, el entrenador al que asistís si sos
   * staff, null para Super Admin y clientes. Es el valor que va en
   * trainer_id/owner_id al crear cosas nuevas.
   */
  actingTrainerId: string | null;
  /** ¿Puede este usuario usar este módulo? El entrenador siempre puede. */
  can: (module: StaffModule, level?: StaffLevel) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [staffAccess, setStaffAccess] = useState<StaffAccess | null>(null);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("No se pudo cargar el perfil:", error.message);
      setProfile(null);
      return;
    }
    const p = data as Profile | null;
    // Para el staff, se carga también a quién asiste antes de soltar el
    // perfil — así ninguna pantalla llega a dibujarse sin saberlo.
    setStaffAccess(p?.role === "staff" ? await loadStaffAccess(p.id) : null);
    setProfile(p);
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setStaffAccess(null);
      }
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? traducirErrorAuth(error.message) : null };
  };

  const signUp: AuthContextValue["signUp"] = async ({ email, password, fullName, inviteCode }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          invite_code: inviteCode ? inviteCode.trim().toUpperCase() : "",
        },
      },
    });
    return { error: error ? traducirErrorAuth(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-clave`,
    });
    return { error: error ? traducirErrorAuth(error.message) : null };
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? traducirErrorAuth(error.message) : null };
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
  };

  const actingTrainerId =
    profile?.role === "trainer" ? profile.id : profile?.role === "staff" ? staffAccess?.trainerId ?? null : null;

  const can: AuthContextValue["can"] = (module, level = "read") => {
    if (profile?.role === "trainer") return true;
    if (profile?.role === "staff") return !!staffAccess && hasLevel(staffAccess.permissions, module, level);
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        initialized,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
        staffAccess,
        actingTrainerId,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

async function loadStaffAccess(staffId: string): Promise<StaffAccess | null> {
  const { data, error } = await supabase
    .from("staff_permissions")
    .select("*, trainer:profiles!staff_permissions_trainer_id_fkey(full_name)")
    .eq("staff_id", staffId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("No se pudo cargar el acceso de staff:", error.message);
    return null;
  }
  const row = data as any;
  const trainer = Array.isArray(row.trainer) ? row.trainer[0] : row.trainer;
  return {
    trainerId: row.trainer_id as string,
    trainerName: (trainer?.full_name as string | undefined) ?? "tu entrenador",
    permissions: (row.permissions ?? {}) as StaffAccess["permissions"],
    // "*" en vez de nombrar la columna: si todavía no se corrió
    // part3p_migration.sql, client_scope no existe y se asume "all".
    clientScope: row.client_scope === "assigned" ? "assigned" : "all",
  };
}

/** Traduce los mensajes de error más comunes de Supabase Auth al español. */
function traducirErrorAuth(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.";
  if (m.includes("user already registered")) return "Ese correo ya tiene una cuenta. Intenta iniciar sesión.";
  if (m.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("invite_code") || m.includes("invitación") || m.includes("invalid") && m.includes("code")) return "El código de invitación no es válido o venció.";
  return mensaje;
}
