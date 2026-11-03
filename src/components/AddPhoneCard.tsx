import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

/**
 * Inicio del alumno: si su ficha no tiene celular (por ejemplo, porque se
 * registró antes de que el formulario de ingreso lo pidiera), le pide que lo
 * agregue. Así su entrenador puede escribirle por WhatsApp.
 */
export default function AddPhoneCard() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [missing, setMissing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.role !== "client") return;
    supabase
      .from("clients")
      .select("phone")
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data }) => setMissing(!!data && !data.phone));
  }, [profile?.id, profile?.role]);

  if (!missing) return null;

  const save = async () => {
    if (!value.trim() || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update({ phone: value.trim() }).eq("profile_id", profile.id);
    if (!error) await supabase.from("profiles").update({ phone: value.trim() }).eq("id", profile.id);
    setSaving(false);
    if (error) return notify(error.message);
    setMissing(false);
    notify("¡Listo! Guardamos tu celular.");
  };

  return (
    <div className="panel" style={{ marginBottom: 16, borderLeft: "4px solid var(--pri)" }}>
      <div className="bd">
        <b>Agrega tu celular</b>
        <p className="note" style={{ margin: "2px 0 10px" }}>Así tu entrenador puede escribirte por WhatsApp.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" type="tel" inputMode="tel" placeholder="Ej. 71234567" style={{ flex: "1 1 180px", maxWidth: 260 }} value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn" onClick={save} disabled={saving || !value.trim()}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
