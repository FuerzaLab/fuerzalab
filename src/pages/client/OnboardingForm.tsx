import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { paths } from "../../routes/paths";
import {
  submitOnboarding,
  MAIN_GOALS,
  PAR_Q_QUESTIONS,
  type ParQAnswers,
} from "../../services/clients";
import { parseHeightCm } from "../../services/assessments";
import { supabase } from "../../lib/supabase";
import { parseDecimal } from "../../lib/decimal";
import { isMinor, GUARDIAN_RELATIONSHIPS } from "../../lib/minors";

export default function OnboardingForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const { profile, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate(paths.login, { replace: true });
  };

  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [sportsHistory, setSportsHistory] = useState("");
  const [injuries, setInjuries] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [parQ, setParQ] = useState<ParQAnswers>({
    heartCondition: false,
    chestPainActivity: false,
    chestPainRest: false,
    dizziness: false,
    boneJoint: false,
    medication: false,
    other: false,
    otherDetail: "",
  });
  const [sleepHours, setSleepHours] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [nutritionQuality, setNutritionQuality] = useState("");
  const [stressLevel, setStressLevel] = useState("");
  const [trainingDays, setTrainingDays] = useState("");
  const [sessionDuration, setSessionDuration] = useState("");
  const [equipmentAccess, setEquipmentAccess] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  // Su propio celular (WhatsApp): se guarda en su ficha, para que el entrenador pueda escribirle.
  const [myPhone, setMyPhone] = useState("");
  useEffect(() => {
    supabase.from("clients").select("phone").eq("id", clientId).maybeSingle().then(({ data }) => {
      if (data?.phone) setMyPhone(data.phone as string);
    });
  }, [clientId]);
  const [emergencyName, setEmergencyName] = useState("");
  // Menores de 18: datos de la madre, padre o tutor.
  const [gName, setGName] = useState("");
  const [gCi, setGCi] = useState("");
  const [gRel, setGRel] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  // CI del propio alumno menor, si tiene (lo pide la autorización).
  const [studentCi, setStudentCi] = useState("");
  const minor = isMinor(birthDate);
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleGoal = (g: string) =>
    setSecondaryGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));

  const submit = async () => {
    if (!myPhone.trim()) return setError("Escribe tu número de celular, para que tu entrenador pueda contactarte.");
    if (!birthDate) return setError("Escribe tu fecha de nacimiento.");
    if (minor && (!gName.trim() || !gCi.trim() || !gRel || !gPhone.trim()))
      return setError("Como eres menor de 18 años, completa los datos de tu madre, padre o tutor.");
    if (!mainGoal) return setError("Elige tu objetivo principal.");
    if (!consent) return setError("Necesitamos que aceptes el consentimiento para continuar.");
    setError("");
    setSaving(true);
    try {
      const { error: phoneError } = await supabase.from("clients").update({ phone: myPhone.trim() }).eq("id", clientId);
      if (phoneError) throw phoneError;
      await submitOnboarding(clientId, {
        birth_date: birthDate || null,
        sex: (sex || null) as any,
        height_cm: heightCm ? parseHeightCm(heightCm) : null, // "1.65" → 165
        weight_kg: parseDecimal(weightKg),
        main_goal: mainGoal,
        secondary_goals: secondaryGoals,
        sports_history: sportsHistory || null,
        injuries: injuries || null,
        medical_notes: medicalNotes || null,
        par_q: parQ,
        habits: { sleepHours, activityLevel, nutritionQuality, stressLevel },
        preferences: { trainingDays, sessionDuration, equipmentAccess, preferredTime },
        emergency_contact: emergencyName
          ? { name: emergencyName, phone: emergencyPhone, relationship: emergencyRelationship }
          : minor
            ? { name: gName.trim(), phone: gPhone.trim(), relationship: gRel }
            : null,
        ...(minor
          ? {
              guardian: {
                name: gName.trim(),
                ci: gCi.trim(),
                relationship: gRel,
                phone: gPhone.trim(),
                ...(gEmail.trim() ? { email: gEmail.trim() } : {}),
                ...(studentCi.trim() ? { student_ci: studentCi.trim() } : {}),
              },
            }
          : {}),
      });
      notify("¡Listo! Ya puedes ver el resto de la app.");
      onDone();
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar tu formulario.");
    }
    setSaving(false);
  };

  const anyParQFlag = PAR_Q_QUESTIONS.some((q) => parQ[q.key]);

  return (
    <div className="auth-shell" style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <h2>Antes de empezar, {profile?.full_name?.split(" ")[0]}</h2>
          <button type="button" className="btn ghost" style={{ padding: "5px 10px", fontSize: 13, flex: "none" }} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
        <p className="note" style={{ marginBottom: 22 }}>
          Completa este formulario una sola vez. Tu entrenador lo necesita para armar tu plan de forma segura.
        </p>

        <h3 style={{ marginBottom: 10 }}>Datos personales</h3>
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <label className="field-label">Tu celular (WhatsApp)</label>
          <input className="input" type="tel" inputMode="tel" placeholder="Ej. 71234567" value={myPhone} onChange={(e) => setMyPhone(e.target.value)} autoComplete="tel" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <label className="field-label">Fecha de nacimiento</label>
            <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Sexo</label>
            <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">Selecciona</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="field-label">Estatura (cm)</label>
            <input className="input" inputMode="decimal" placeholder="Ej. 165" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} onBlur={() => { const cm = parseHeightCm(heightCm); if (cm != null && String(cm) !== heightCm) setHeightCm(String(cm)); }} />
          </div>
          <div>
            <label className="field-label">Peso (kg)</label>
            <input className="input" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
        </div>

        <h3 style={{ marginBottom: 10 }}>Objetivos</h3>
        <label className="field-label">Objetivo principal</label>
        <select className="input" style={{ marginBottom: 12 }} value={mainGoal} onChange={(e) => setMainGoal(e.target.value)}>
          <option value="">Selecciona</option>
          {MAIN_GOALS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <label className="field-label">Objetivos secundarios (opcional)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {MAIN_GOALS.filter((g) => g !== mainGoal).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGoal(g)}
              className="chip"
              style={{ cursor: "pointer", border: "1px solid var(--line)", background: secondaryGoals.includes(g) ? "var(--pri)" : "#fff", color: secondaryGoals.includes(g) ? "#fff" : "var(--muted)" }}
            >
              {g}
            </button>
          ))}
        </div>

        <h3 style={{ marginBottom: 10 }}>Salud — cuestionario PAR-Q+</h3>
        <p className="note" style={{ marginBottom: 12 }}>
          Responde con sinceridad. Si marcas "Sí" en alguna, no significa que no puedas entrenar — tu entrenador lo va a tener en cuenta.
        </p>
        <div style={{ marginBottom: 20 }}>
          {PAR_Q_QUESTIONS.map((q) => (
            <div key={q.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 14 }}>{q.text}</span>
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                {[["Sí", true], ["No", false]].map(([label, val]) => (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => setParQ((p) => ({ ...p, [q.key]: val }))}
                    className="chip"
                    style={{ cursor: "pointer", border: "1px solid var(--line)", background: parQ[q.key] === val ? "var(--pri)" : "#fff", color: parQ[q.key] === val ? "#fff" : "var(--muted)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {parQ.other && (
            <input className="input" style={{ marginTop: 10 }} placeholder="Cuéntanos cuál" value={parQ.otherDetail} onChange={(e) => setParQ((p) => ({ ...p, otherDetail: e.target.value }))} />
          )}
          {anyParQFlag && (
            <p style={{ color: "var(--warn)", fontSize: 13.5, marginTop: 10 }}>
              Marcaste al menos una señal de alerta. Tu entrenador la va a revisar antes de armar tu plan.
            </p>
          )}
        </div>

        <label className="field-label">Lesiones o molestias actuales</label>
        <textarea className="input" style={{ minHeight: 60, marginBottom: 14 }} value={injuries} onChange={(e) => setInjuries(e.target.value)} />

        <label className="field-label">Historial deportivo</label>
        <textarea className="input" style={{ minHeight: 60, marginBottom: 14 }} value={sportsHistory} onChange={(e) => setSportsHistory(e.target.value)} />

        <label className="field-label">Medicamentos, alergias o condiciones médicas</label>
        <textarea className="input" style={{ minHeight: 60, marginBottom: 20 }} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Ej. Alergia a la penicilina, hipotiroidismo, toma losartán" />

        <h3 style={{ marginBottom: 10 }}>Hábitos y preferencias</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <label className="field-label">Horas de sueño por noche</label>
            <input className="input" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="Ej. 7" />
          </div>
          <div>
            <label className="field-label">Nivel de actividad diaria</label>
            <select className="input" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
              <option value="">Selecciona</option>
              <option value="sedentario">Sedentario</option>
              <option value="ligero">Ligero</option>
              <option value="moderado">Moderado</option>
              <option value="alto">Alto</option>
            </select>
          </div>
          <div>
            <label className="field-label">Calidad de la alimentación</label>
            <select className="input" value={nutritionQuality} onChange={(e) => setNutritionQuality(e.target.value)}>
              <option value="">Selecciona</option>
              <option value="desordenada">Desordenada</option>
              <option value="regular">Regular</option>
              <option value="cuidada">Cuidada</option>
              <option value="con plan de un nutricionista">Con plan de un nutricionista</option>
            </select>
          </div>
          <div>
            <label className="field-label">Nivel de estrés habitual</label>
            <select className="input" value={stressLevel} onChange={(e) => setStressLevel(e.target.value)}>
              <option value="">Selecciona</option>
              <option value="bajo">Bajo</option>
              <option value="moderado">Moderado</option>
              <option value="alto">Alto</option>
            </select>
          </div>
          <div>
            <label className="field-label">Días disponibles para entrenar</label>
            <input className="input" value={trainingDays} onChange={(e) => setTrainingDays(e.target.value)} placeholder="Ej. Lunes, miércoles, viernes" />
          </div>
          <div>
            <label className="field-label">Duración preferida por sesión</label>
            <input className="input" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} placeholder="Ej. 60 minutos" />
          </div>
          <div>
            <label className="field-label">Equipamiento al que tienes acceso</label>
            <input className="input" value={equipmentAccess} onChange={(e) => setEquipmentAccess(e.target.value)} placeholder="Ej. Gimnasio completo, o solo mancuernas en casa" />
          </div>
          <div>
            <label className="field-label">Horario preferido para entrenar</label>
            <input className="input" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} placeholder="Ej. Mañanas" />
          </div>
        </div>

        {minor && (
          <div className="guardian-box">
            <h3 style={{ margin: "0 0 6px" }}>Datos de tu madre, padre o tutor</h3>
            <p className="note" style={{ margin: "0 0 12px" }}>
              Como eres menor de 18 años, tu entrenador necesita la autorización firmada de tu madre, padre o tutor. Él se la va a
              pedir; acá solo carga sus datos.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              <div>
                <label className="field-label">Nombre completo</label>
                <input className="input" value={gName} onChange={(e) => setGName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Carnet de identidad</label>
                <input className="input" value={gCi} onChange={(e) => setGCi(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Parentesco</label>
                <select className="input" value={gRel} onChange={(e) => setGRel(e.target.value)}>
                  <option value="">Elige…</option>
                  {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Celular (WhatsApp)</label>
                <input className="input" type="tel" inputMode="tel" value={gPhone} onChange={(e) => setGPhone(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Su correo (opcional)</label>
                <input className="input" type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12, maxWidth: 260 }}>
              <label className="field-label">Tu carnet de identidad (si tienes)</label>
              <input className="input" value={studentCi} onChange={(e) => setStudentCi(e.target.value)} />
            </div>
          </div>
        )}

        <h3 style={{ marginBottom: 10 }}>Contacto de emergencia</h3>
        <p className="note" style={{ marginBottom: 12 }}>Opcional, pero recomendado para entrenar con mayor seguridad.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div>
            <label className="field-label">Nombre</label>
            <input className="input" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Teléfono</label>
            <input className="input" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Relación</label>
            <input className="input" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} placeholder="Ej. Madre, pareja" />
          </div>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, fontSize: 13.5 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Confirmo que la información que di es verdadera a mi leal saber y entender, y acepto que mi entrenador la
            use para diseñar mi plan de entrenamiento.
            {minor && " Mi madre, padre o tutor está al tanto, y mi entrenador le va a pedir su autorización firmada."}
          </span>
        </label>

        {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}
        <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Enviar formulario"}
        </button>
      </div>
    </div>
  );
}
