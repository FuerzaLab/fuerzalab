import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/auth";

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

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
    setProfile(data as Profile | null);
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
