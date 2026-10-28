import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import { OPTIONAL_SECTIONS, hiddenSections } from "../lib/menuSections";

/** Configuración → "Secciones que uso" (solo entrenadores). */
export default function MenuSectionsPanel() {
  const { profile, refreshProfile } = useAuth();
  const { notify } = useToast();
  const [hidden, setHidden] = useState<string[]>(() => hiddenSections(profile));
  const [saving, setSaving] = useState(false);
  useEffect(() => setHidden(hiddenSections(profile)), [profile]);

  if (profile?.role !== "trainer") return null;

  const toggle = async (to: string) => {
    const next = hidden.includes(to) ? hidden.filter((x) => x !== to) : [...hidden, to];
    const prev = hidden;
    setHidden(next);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ menu_hidden: next }).eq("id", profile.id);
    setSaving(false);
    if (error) {
      setHidden(prev);
      notify(/menu_hidden/.test(error.message) ? "Falta correr part3w_migration.sql en Supabase." : error.message);
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="panel" style={{ marginBottom: 18, maxWidth: 560 }}>
      <div className="hd"><h3>Secciones que uso</h3></div>
      <div className="bd">
        <p className="note" style={{ marginTop: 0 }}>
          Elige qué aparece en "Más herramientas" de tu menú. Ocultar una sección no borra nada: la vuelves a prender cuando
          quieras. Inicio, Entrenar con cliente, Agenda, Clientes, Mensajes y el Constructor siempre están.
        </p>
        <div style={{ display: "grid", gap: 2 }}>
          {OPTIONAL_SECTIONS.map((sct) => {
            const on = !hidden.includes(sct.to);
            return (
              <label key={sct.to} className="section-toggle">
                <input type="checkbox" checked={on} disabled={saving} onChange={() => toggle(sct.to)} />
                <span style={{ flex: 1 }}>
                  <b>{sct.label}</b>
                  <span className="note" style={{ display: "block", fontSize: 12.5 }}>{sct.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
