import { supabase } from "../lib/supabase";
import { exportReportPdf } from "../lib/exportReportPdf";
import { ageFrom, LEGAL_PROVIDER, type Guardian } from "../lib/minors";
import type { ClientRow } from "./clients";

/**
 * Menores de edad (part4k_migration.sql): autorización firmada por la madre,
 * padre o tutor. El entrenador descarga el PDF para firmar, lo recibe en
 * persona, sube una foto y queda registrado (fecha y quién). La foto va a la
 * carpeta privada del alumno que solo ve el entrenador (…/trainer/…).
 */
const missing = (e: any) => (/guardian_consent/.test(e?.message ?? "") ? new Error("Falta correr part4k_migration.sql en Supabase.") : e);

export async function uploadGuardianConsent(client: ClientRow, file: File, trainerId: string, photosOk: boolean): Promise<ClientRow> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${client.organization_id}/${client.id}/trainer/autorizacion-tutor-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("client-files").upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const fields: Partial<ClientRow> & Record<string, unknown> = { guardian_consent_at: new Date().toISOString(), guardian_consent_path: path, guardian_consent_by: trainerId, guardian_photos_ok: photosOk };
  let { error } = await supabase.from("clients").update(fields).eq("id", client.id);
  // Sin part4l_migration.sql no existe guardian_photos_ok: se guarda la autorización igual.
  if (error && /guardian_photos_ok/.test(error.message)) {
    delete fields.guardian_photos_ok;
    ({ error } = await supabase.from("clients").update(fields).eq("id", client.id));
  }
  if (error) {
    await supabase.storage.from("client-files").remove([path]).catch(() => {});
    throw missing(error);
  }
  return { ...client, ...(fields as Partial<ClientRow>) };
}

/** Cambiar después si el tutor autorizó o no las fotos de progreso. */
export async function setGuardianPhotos(client: ClientRow, ok: boolean): Promise<ClientRow> {
  const { error } = await supabase.from("clients").update({ guardian_photos_ok: ok }).eq("id", client.id);
  if (error) throw /guardian_photos_ok/.test(error.message) ? new Error("Falta correr part4l_migration.sql en Supabase.") : error;
  return { ...client, guardian_photos_ok: ok };
}

export async function guardianConsentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

/** Deshacer: por ejemplo, si se subió la foto equivocada. */
export async function clearGuardianConsent(client: ClientRow): Promise<ClientRow> {
  if (client.guardian_consent_path) await supabase.storage.from("client-files").remove([client.guardian_consent_path]).catch(() => {});
  const fields: Record<string, unknown> = { guardian_consent_at: null, guardian_consent_path: null, guardian_consent_by: null, guardian_photos_ok: false };
  let { error } = await supabase.from("clients").update(fields).eq("id", client.id);
  if (error && /guardian_photos_ok/.test(error.message)) {
    delete fields.guardian_photos_ok;
    ({ error } = await supabase.from("clients").update(fields).eq("id", client.id));
  }
  if (error) throw missing(error);
  return { ...client, ...(fields as Partial<ClientRow>) };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * PDF "Autorización de madre, padre o tutor": el texto revisado por el
 * abogado (versión final), con los datos del alumno, del tutor y del
 * entrenador ya completos, listo para imprimir y firmar.
 */
export async function downloadGuardianConsentPdf(params: {
  clientName: string;
  birthDate: string | null;
  guardian: Guardian | null;
  trainerName: string;
  orgName: string;
}) {
  const g = params.guardian;
  const P = LEGAL_PROVIDER;
  const age = ageFrom(params.birthDate);
  const v = (x?: string | null) => (x ? esc(x) : "");
  const birth = params.birthDate
    ? `${esc(new Date(params.birthDate.slice(0, 10) + "T12:00:00").toLocaleDateString("es"))}${age != null ? ` (${age} años)` : ""}`
    : "";
  const row = (k: string, val: string) => `<tr><td>${k}</td><td class="v">${val}</td></tr>`;
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
  el.innerHTML = `<style>
    .gc{font-family:Arial,sans-serif;color:#14202B;padding:38px 44px;font-size:12.3px;line-height:1.5}
    .gc .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1E3FA8;padding-bottom:10px;margin-bottom:8px}
    .gc .hd h1{font-size:19px;margin:0;color:#0F1A33}
    .gc .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:17px;color:#0F1A33}.gc .brand span{color:#1E3FA8}.gc .brand img{height:32px;border-radius:7px}
    .gc .prov{font-size:10.5px;color:#5E6A73;margin:0 0 12px}
    .gc h2{font-size:13px;color:#1E3FA8;margin:14px 0 4px}
    .gc table{border-collapse:collapse;width:100%}.gc td{padding:6px 7px;border-bottom:1px solid #DCE1DA;color:#5E6A73}.gc td.v{width:60%;color:#14202B}
    .gc p{margin:0 0 7px}.gc .box{font-size:15px}
    .gc .sign{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:38px}.gc .sign div{border-top:1px solid #14202B;padding-top:5px;font-size:11px}
    .gc .small{font-size:10px;color:#5E6A73;margin-top:16px}
  </style>
  <div class="gc">
    <div class="hd"><h1>Autorización de madre, padre o tutor</h1><div class="brand"><img src="/logo.png"><b>Fuerza<span>Lab</span></b></div></div>
    <p class="prov">Servicio prestado por ${esc(P.name)}, NIT ${esc(P.nit)}, domicilio en ${esc(P.address)}, correo ${esc(P.email)}.</p>
    <h2>Alumno o alumna (menor de 18 años)</h2>
    <table>${row("Nombre completo", v(params.clientName))}${row("Fecha de nacimiento y edad", birth)}${row("Carnet de identidad Nº (si tiene)", v(g?.student_ci))}</table>
    <h2>Madre, padre o tutor</h2>
    <table>${row("Nombre completo", v(g?.name))}${row("Carnet de identidad Nº", v(g?.ci))}${row("Parentesco", v(g?.relationship))}${row("Celular", v(g?.phone))}${row("Correo (opcional)", v(g?.email))}</table>
    <h2>Entrenador</h2>
    <table>${row("Nombre completo", v(params.trainerName))}${row("Estudio o marca", v(params.orgName))}</table>
    <h2>Qué autorizo</h2>
    <p>Como madre, padre o tutor del alumno o alumna indicado arriba, declaro y autorizo lo siguiente:</p>
    <p><b>1. Entrenamiento.</b> Autorizo que realice el entrenamiento planificado por su entrenador. Declaro que la información de salud que proporciono es verdadera y completa. Fui informado(a) de que FuerzaLab no da indicaciones médicas y de que, si el cuestionario PAR-Q+ señala algún riesgo, se recomienda una consulta médica antes de entrenar.</p>
    <p><b>2. Datos que se registran.</b> Autorizo que su entrenador registre en la aplicación FuerzaLab sus datos personales y de contacto, su contacto de emergencia, el formulario de ingreso, sus entrenamientos, sus registros de bienestar, sus evaluaciones físicas y medidas, los mensajes con su entrenador y sus pagos.</p>
    <p><b>3. Datos de salud.</b> Sé que los datos de salud son datos sensibles. Autorizo de forma expresa que se registren las respuestas al cuestionario PAR-Q+, lesiones o molestias, medicamentos, alergias, condiciones médicas y registros de sueño, fatiga, estrés y dolor. Estos datos se usarán únicamente para que el entrenamiento sea seguro y adecuado.</p>
    <p><b>4. Datos registrados con anterioridad.</b> Autorizo también el uso de los datos del alumno o alumna que ya fueron registrados en FuerzaLab antes de la fecha de este documento.</p>
    <p><b>5. Quién ve los datos y dónde se guardan.</b> Los datos los ve su entrenador y, si los tiene, los asistentes a quienes él les dé permiso. FuerzaLab accede a ellos solo cuando hace falta para dar soporte técnico. Autorizo que los datos se guarden en los servidores de Supabase y Netlify, ubicados fuera de Bolivia (${esc(P.servers)}). Los datos no se venden ni se usan para publicidad.</p>
    <p><b>6. Fotos de progreso.</b> <span class="box">☐</span> Autorizo &nbsp; <span class="box">☐</span> No autorizo que se tomen y guarden fotos del progreso físico del alumno o alumna. Las fotos solo las verá su entrenador y no se publicarán en redes sociales, publicidad ni ningún otro medio sin otra autorización escrita. Si no marco ninguna opción, se entiende que no autorizo.</p>
    <p><b>7. Mis derechos.</b> En cualquier momento puedo pedir acceso a los datos, su corrección o su eliminación, o retirar esta autorización. Puedo hacerlo ante el entrenador o escribiendo a ${esc(P.email)}. Recibiré respuesta en un plazo de 15 días hábiles. Si retiro la autorización, los datos se eliminarán en un plazo de 15 días hábiles.</p>
    <p><b>8. Términos y Política de privacidad.</b> Declaro haber leído y aceptado los Términos de uso y la Política de privacidad de FuerzaLab, disponibles en ${esc(P.termsUrl)} y ${esc(P.privacyUrl)}, en su versión vigente a la fecha de este documento.</p>
    <p><b>9. Vigencia.</b> Esta autorización rige hasta que el alumno o alumna cumpla 18 años o hasta que yo la retire. Al cumplir la mayoría de edad, el alumno o alumna podrá ratificarla por sí mismo(a).</p>
    <h2>Conformidad del alumno o alumna</h2>
    <p>Fui informado(a) de esta autorización y estoy de acuerdo.</p>
    <div class="sign"><div>Firma de la madre, padre o tutor</div><div>Aclaración y CI Nº</div></div>
    <div class="sign" style="margin-top:30px"><div>Firma del alumno o alumna</div><div>Lugar y fecha</div></div>
    <p class="small">El entrenador guarda una copia de este documento firmado en la ficha del alumno en FuerzaLab, en una sección a la que solo él tiene acceso, y entrega una copia a la madre, padre o tutor.</p>
  </div>`;
  document.body.appendChild(el);
  try {
    await new Promise((r) => setTimeout(r, 250));
    await exportReportPdf(el.lastElementChild as HTMLElement, `Autorizacion-tutor-${params.clientName.replace(/\s+/g, "-")}`);
  } finally {
    el.remove();
  }
}
