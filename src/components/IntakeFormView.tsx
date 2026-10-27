import type { ReactNode } from "react";
import { MAIN_GOALS, PAR_Q_QUESTIONS, type ClientProfileRow } from "../services/clients";
import { ReportBrandHeader } from "./ui/Brand";

/**
 * El formulario de ingreso completo, en solo lectura y en el mismo orden en
 * que lo llena el alumno (pages/client/OnboardingForm.tsx).
 *
 * - Con `data`: las respuestas de un alumno, para que el entrenador las lea
 *   todas juntas (y las descargue en PDF como respaldo).
 * - Sin `data`: el formulario vacío, para que el entrenador vea qué le va a
 *   pedir la app a su alumno antes de invitarlo.
 *
 * Si se cambian las preguntas del formulario del alumno, hay que
 * actualizar también esta vista.
 */

const SEX: Record<string, string> = { female: "Femenino", male: "Masculino", other: "Otro" };
const OPTIONS = {
  activity: ["Sedentario", "Ligero", "Moderado", "Alto"],
  nutrition: ["Desordenada", "Regular", "Cuidada", "Con plan de un nutricionista"],
  stress: ["Bajo", "Moderado", "Alto"],
};
const CONSENT_TEXT =
  "Confirmo que la información que di es verdadera a mi leal saber y entender, y acepto que mi entrenador la use para diseñar mi plan de entrenamiento.";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

function age(birth: string): number {
  const b = new Date(birth + "T12:00:00");
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="intake-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Una pregunta con su respuesta; en el formulario vacío, la respuesta es un renglón (o las opciones posibles). */
function Field({ label, value, blank, options, wide }: { label: string; value?: ReactNode; blank: boolean; options?: string[]; wide?: boolean }) {
  return (
    <div className={`intake-field${wide ? " wide" : ""}`}>
      <div className="intake-label">{label}</div>
      {blank ? (
        options ? <div className="intake-options">{options.map((o) => <span key={o}>☐ {o}</span>)}</div> : <div className="intake-blank" />
      ) : (
        <div className="intake-value">{value === null || value === undefined || value === "" ? <span className="note">Sin responder</span> : value}</div>
      )}
    </div>
  );
}

export default function IntakeFormView({ data, clientName }: { data?: ClientProfileRow | null; clientName?: string }) {
  const blank = !data;
  const d = data ?? null;
  const parq = d?.par_q ?? null;

  return (
    <div className="intake">
      <ReportBrandHeader label={blank ? "Modelo del formulario" : "Formulario de ingreso"} />
      <div className="intake-title">
        <h2>Formulario de ingreso{clientName ? ` — ${clientName}` : ""}</h2>
        <span className="note">
          {blank
            ? "Esto es lo que completa cada alumno la primera vez que entra a la app, antes de ver su plan."
            : d?.submitted_at
              ? `Completado el ${fmtDate(d.submitted_at)}${d.reviewed_at ? ` · revisado el ${fmtDate(d.reviewed_at)}` : " · sin revisar"}`
              : "Todavía no lo completó."}
        </span>
      </div>

      <Section title="Datos personales">
        <div className="intake-grid">
          <Field label="Fecha de nacimiento" blank={blank} value={d?.birth_date ? `${fmtDate(d.birth_date)} (${age(d.birth_date)} años)` : null} />
          <Field label="Sexo" blank={blank} options={["Femenino", "Masculino", "Otro"]} value={d?.sex ? SEX[d.sex] : null} />
          <Field label="Estatura" blank={blank} value={d?.height_cm ? `${d.height_cm} cm` : null} />
          <Field label="Peso" blank={blank} value={d?.weight_kg ? `${d.weight_kg} kg` : null} />
        </div>
      </Section>

      <Section title="Objetivos">
        <div className="intake-grid">
          <Field label="Objetivo principal" blank={blank} options={MAIN_GOALS} value={d?.main_goal} wide />
          <Field label="Objetivos secundarios (opcional)" blank={blank} options={MAIN_GOALS} value={d?.secondary_goals?.length ? d.secondary_goals.join(", ") : null} wide />
        </div>
      </Section>

      <Section title="Salud — cuestionario PAR-Q+">
        <table className="intake-parq">
          <tbody>
            {PAR_Q_QUESTIONS.map((q, i) => {
              const yes = !!parq?.[q.key];
              return (
                <tr key={q.key} className={!blank && yes ? "yes" : ""}>
                  <td className="n">{i + 1}</td>
                  <td>{q.text}</td>
                  <td className="ans">
                    {blank ? "☐ Sí   ☐ No" : parq ? (yes ? <b>Sí</b> : "No") : <span className="note">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!blank && parq?.other && parq.otherDetail && <p style={{ margin: "8px 0 0" }}><b>Detalle:</b> {parq.otherDetail}</p>}
        {!blank && parq && PAR_Q_QUESTIONS.some((q) => parq[q.key]) && (
          <p className="intake-alert">Respondió "Sí" a al menos una pregunta: conviene revisar estas señales (y, si corresponde, pedir el visto bueno de un médico) antes de armar el plan.</p>
        )}
        <div className="intake-grid" style={{ marginTop: 12 }}>
          <Field label="Lesiones o molestias actuales" blank={blank} value={d?.injuries} wide />
          <Field label="Historial deportivo" blank={blank} value={d?.sports_history} wide />
          <Field label="Medicamentos, alergias o condiciones médicas" blank={blank} value={d?.medical_notes} wide />
        </div>
      </Section>

      <Section title="Hábitos y preferencias">
        <div className="intake-grid">
          <Field label="Horas de sueño por noche" blank={blank} value={d?.habits?.sleepHours ? `${d.habits.sleepHours} h` : null} />
          <Field label="Nivel de actividad diaria" blank={blank} options={OPTIONS.activity} value={d?.habits?.activityLevel ? cap(d.habits.activityLevel) : null} />
          <Field label="Calidad de la alimentación" blank={blank} options={OPTIONS.nutrition} value={d?.habits?.nutritionQuality ? cap(d.habits.nutritionQuality) : null} />
          <Field label="Nivel de estrés habitual" blank={blank} options={OPTIONS.stress} value={d?.habits?.stressLevel ? cap(d.habits.stressLevel) : null} />
          <Field label="Días disponibles para entrenar" blank={blank} value={d?.preferences?.trainingDays} />
          <Field label="Duración preferida por sesión" blank={blank} value={d?.preferences?.sessionDuration} />
          <Field label="Equipamiento al que tiene acceso" blank={blank} value={d?.preferences?.equipmentAccess} />
          <Field label="Horario preferido para entrenar" blank={blank} value={d?.preferences?.preferredTime} />
        </div>
      </Section>

      <Section title="Contacto de emergencia">
        <div className="intake-grid">
          <Field label="Nombre" blank={blank} value={d?.emergency_contact?.name} />
          <Field label="Teléfono" blank={blank} value={d?.emergency_contact?.phone} />
          <Field label="Relación" blank={blank} value={d?.emergency_contact?.relationship} />
        </div>
      </Section>

      <Section title="Consentimiento">
        <p style={{ margin: 0 }}>
          {blank ? "☐" : d?.consent_accepted ? "☑" : "☐"} {CONSENT_TEXT}
        </p>
        {!blank && (
          <p className="note" style={{ margin: "6px 0 0" }}>
            {d?.consent_accepted
              ? `Aceptado al enviar el formulario${d.submitted_at ? `, el ${fmtDate(d.submitted_at)}` : ""}.`
              : "No aceptado."}
          </p>
        )}
      </Section>
    </div>
  );
}
