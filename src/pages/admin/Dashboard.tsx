import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [trainerCount, setTrainerCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: orgs, error: orgErr }, { count: trainers, error: trErr }] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "trainer"),
      ]);
      if (cancelled) return;
      if (orgErr || trErr) {
        setError((orgErr ?? trErr)!.message);
        return;
      }
      setOrgCount(orgs ?? 0);
      setTrainerCount(trainers ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Panel de la plataforma</h1>
      <p className="note" style={{ marginBottom: 20 }}>Bienvenido, {profile?.full_name}.</p>

      {error && (
        <div className="panel" style={{ marginBottom: 18, borderColor: "var(--bad)" }}>
          <div className="bd">
            <p className="error-text">No pudimos consultar Supabase: {error}</p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        <div className="panel">
          <div className="bd">
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 700 }}>
              {orgCount ?? "—"}
            </div>
            <div className="note">Organizaciones</div>
          </div>
        </div>
        <div className="panel">
          <div className="bd">
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 700 }}>
              {trainerCount ?? "—"}
            </div>
            <div className="note">Entrenadores</div>
          </div>
        </div>
      </div>

      <p className="note" style={{ marginTop: 20 }}>
        Estos números se leen en vivo desde tu base de datos de Supabase.
      </p>
    </div>
  );
}
