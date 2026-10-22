import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";
import PasswordInput from "../../components/ui/PasswordInput";

export default function Settings() {
  const { profile, updatePassword, refreshProfile } = useAuth();
  const { notify } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!profile) return null;

  const saveProfile = async () => {
    if (!fullName.trim()) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone || null }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      notify("Datos actualizados.");
    } catch (e: any) {
      notify(e.message);
    }
    setSavingProfile(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return setPasswordError("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirmPassword) return setPasswordError("Las contraseñas no coinciden.");
    setPasswordError("");
    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);
    if (error) {
      setPasswordError(error);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    notify("Contraseña actualizada.");
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Configuración</h1>

      <div className="panel" style={{ marginBottom: 18, maxWidth: 420 }}>
        <div className="hd"><h3>Tus datos</h3></div>
        <div className="bd">
          <label className="field-label">Nombre completo</label>
          <input className="input" style={{ marginBottom: 12 }} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <label className="field-label">Teléfono</label>
          <input className="input" style={{ marginBottom: 16 }} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="field-label">Correo electrónico</label>
          <p className="note" style={{ marginBottom: 16 }}>{profile.email} (no se puede cambiar desde aquí)</p>
          <button className="btn" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="hd"><h3>Cambiar contraseña</h3></div>
        <div className="bd">
          <label className="field-label">Nueva contraseña</label>
          <PasswordInput style={{ marginBottom: 12 }} value={newPassword} onChange={setNewPassword} />
          <label className="field-label">Confirmar contraseña</label>
          <PasswordInput style={{ marginBottom: 12 }} value={confirmPassword} onChange={setConfirmPassword} />
          {passwordError && <p className="error-text" style={{ marginBottom: 12 }}>{passwordError}</p>}
          <button className="btn" onClick={changePassword} disabled={savingPassword}>{savingPassword ? "Guardando…" : "Cambiar contraseña"}</button>
        </div>
      </div>
    </div>
  );
}
