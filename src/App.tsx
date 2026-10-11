import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AppRoutes from "./routes";
import { supabaseConfigured } from "./lib/supabase";

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2 style={{ marginBottom: 10 }}>Falta conectar Supabase</h2>
          <p className="note">
            No encontramos <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Copia{" "}
            <code>.env.example</code> como <code>.env</code> (en local) o configura esas dos variables en Netlify, y
            vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
