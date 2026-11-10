import { createClient } from "@supabase/supabase-js";
import { DEMO_CLIENT_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from "../lib/demo";
import { demoNeedsSeed, linkDemoStudent, seedDemo } from "./demoSeed";

/**
 * "Ver la demo como alumno": antes de entrar con la cuenta de alumno, la app
 * inicia sesión APARTE (sin tocar la sesión principal) con el entrenador de
 * la demo, recarga los datos de ejemplo si tienen más de un día y conecta la
 * cuenta de alumno con la alumna de ejemplo. Así el alumno ve su rutina, sus
 * récords y su progreso al día.
 */
export async function prepareStudentDemo(onProgress?: (msg: string) => void): Promise<void> {
  const say = onProgress ?? (() => {});
  const team = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "fl-demo-student-prep" },
  });
  const { data, error } = await team.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error || !data.user) throw new Error("La demo no está disponible en este momento.");
  try {
    const { data: prof } = await team.from("profiles").select("organization_id").eq("id", data.user.id).single();
    if (await demoNeedsSeed(data.user.id, team)) {
      say("Preparando la demo…");
      await seedDemo({ organizationId: prof!.organization_id as string, trainerId: data.user.id, client: team, onProgress: say });
    }
    const ok = await linkDemoStudent(data.user.id, DEMO_CLIENT_EMAIL, team);
    if (!ok) throw new Error("La demo del alumno no está configurada todavía.");
  } finally {
    await team.auth.signOut().catch(() => {});
  }
}
