import { supabase } from "../lib/supabase";
import { exportReportPdf } from "../lib/exportReportPdf";
import { ageFrom, type Guardian } from "../lib/minors";
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

/** PDF "Autorización de madre, padre o tutor", listo para imprimir y firmar. */
export async function downloadGuardianConsentPdf(params: {
  clientName: string;
  birthDate: string | null;
  guardian: Guardian | null;
  trainerName: string;
  orgName: string;
}) {
  const g = params.guardian;
  const age = ageFrom(params.birthDate);
  const line = (v?: string | null) => (v ? esc(v) : "<span class='blank'></span>");
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
  el.innerHTML = `<style>
    .gc{font-family:Arial,sans-serif;color:#14202B;padding:40px 46px;font-size:13px;line-height:1.55}
    .gc .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1E3FA8;padding-bottom:12px;margin-bottom:18px}
    .gc .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:18px;color:#0F1A33}.gc .brand span{color:#1E3FA8}.gc .brand img{height:34px;border-radius:8px}
    .gc h1{font-size:19px;margin:0;color:#0F1A33}.gc h2{font-size:14px;color:#1E3FA8;margin:16px 0 6px}
    .gc table{border-collapse:collapse;width:100%}.gc td{padding:5px 6px;border-bottom:1px solid #EEF1EC;vertical-align:top}.gc td.k{width:34%;color:#5E6A73}
    .gc ul{margin:4px 0;padding-left:18px}.gc .blank{display:inline-block;min-width:220px;border-bottom:1px solid #8B93A7}
    .gc .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:46px}.gc .sign div{border-top:1px solid #14202B;padding-top:6px;font-size:12px}
    .gc .small{font-size:11px;color:#5E6A73;margin-top:22px}
  </style>
  <div class="gc">
    <div class="hd"><h1>Autorización de madre, padre o tutor</h1><div class="brand"><img src="/logo.png"><b>Fuerza<span>Lab</span></b></div></div>
    <h2>Alumno o alumna (menor de 18 años)</h2>
    <table>
      <tr><td class="k">Nombre completo</td><td>${line(params.clientName)}</td></tr>
      <tr><td class="k">Fecha de nacimiento</td><td>${params.birthDate ? esc(new Date(params.birthDate.slice(0, 10) + "T12:00:00").toLocaleDateString("es")) : line(null)}${age != null ? ` (${age} años)` : ""}</td></tr>
    </table>
    <h2>Madre, padre o tutor</h2>
    <table>
      <tr><td class="k">Nombre completo</td><td>${line(g?.name)}</td></tr>
      <tr><td class="k">Carnet de identidad</td><td>${line(g?.ci)}</td></tr>
      <tr><td class="k">Parentesco</td><td>${line(g?.relationship)}</td></tr>
      <tr><td class="k">Celular</td><td>${line(g?.phone)}</td></tr>
    </table>
    <h2>Entrenador</h2>
    <table>
      <tr><td class="k">Entrenador</td><td>${line(params.trainerName)}</td></tr>
      <tr><td class="k">Estudio o marca</td><td>${line(params.orgName)}</td></tr>
    </table>
    <h2>Qué autorizo</h2>
    <p>Como madre, padre o tutor del alumno o alumna indicado arriba, autorizo:</p>
    <ul>
      <li>Que realice el entrenamiento planificado por su entrenador.</li>
      <li>Que use la aplicación FuerzaLab, y que en ella se registren sus datos: datos personales y de contacto, formulario de salud (PAR-Q+, lesiones, medicación), evaluaciones físicas y medidas, sus entrenamientos, su bienestar diario y sus pagos.</li>
      <li>Que esos datos se usen solo para planificar y acompañar su entrenamiento. Los ve su entrenador (y, si los hay, los asistentes que él autorice); no se venden ni se usan para publicidad.</li>
    </ul>
    <p>Declaro que conozco los Términos de uso y la Política de privacidad de FuerzaLab, y que puedo pedir en cualquier momento que se corrijan o se borren sus datos, o retirar esta autorización, avisándole al entrenador.</p>
    <p>Fotos de progreso: &nbsp; ☐ Autorizo &nbsp;&nbsp; ☐ No autorizo &nbsp; que se tomen fotos de su progreso físico, que solo verá su entrenador.</p>
    <div class="sign">
      <div>Firma de la madre, padre o tutor</div>
      <div>Aclaración y CI</div>
    </div>
    <div class="sign" style="margin-top:34px">
      <div>Lugar y fecha</div>
      <div>Firma del alumno o alumna (opcional)</div>
    </div>
    <p class="small">El entrenador guarda una foto de este documento firmado en la ficha del alumno en FuerzaLab, en un lugar que solo él ve. Generado el ${new Date().toLocaleDateString("es")}.</p>
  </div>`;
  document.body.appendChild(el);
  try {
    await new Promise((r) => setTimeout(r, 250));
    await exportReportPdf(el.lastElementChild as HTMLElement, `Autorizacion-tutor-${params.clientName.replace(/\s+/g, "-")}`);
  } finally {
    el.remove();
  }
}
