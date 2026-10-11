import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // No detenemos la app: mostramos un aviso claro en pantalla en vez de una
  // página en blanco, para que sea fácil de diagnosticar sin consola.
  console.error(
    "Faltan las variables VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. " +
      "Revisa tu archivo .env (en local) o las variables de entorno en Netlify."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const supabaseConfigured = Boolean(url && anonKey);
