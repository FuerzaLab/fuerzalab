import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import WhatsAppButton from "../../../components/WhatsAppButton";
import { inviteTrainer } from "../../../services/admin";
import { supabase } from "../../../lib/supabase";
import { paths } from "../../../routes/paths";

/**
 * Tu estudio → Entrenadores: el dueño invita entrenadores a su propio estudio
 * (part4e_migration.sql), dentro del límite de entrenadores de su plan.
 */
type PendingInv = { id: string; full_name: string | null; email: string | null; code: string; created_at: string };

export default function StudioTrainersPanel({ trainerCount }: { trainerCount: number }) {
  const { profile, orgBilling } = useAuth();
  const { notify } = useToast();
  const [pending, setPending] = useState<PendingInv[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [justCreated, setJustCreated] = useState<{ name: string; phone: string; link: string } | null>(null);

  const linkFor = (code: string) => `${window.location.origin}${paths.register}?codigo=${code}`;
  const msgFor = (n: string, link: string) =>
    `Hola ${n.split(" ")[0]}! Te invito a sumarte a nuestro estudio en FuerzaLab, la app con la que armamos los planes y seguimos a los alumnos. Crea tu cuenta acá: ${link}`;

  const load = () =>
    supabase
      .from("invitations")
      .select("id, full_name, email, code, created_at")
      .eq("role", "trainer")
      .eq("status", "pending")
      .eq("invited_by", profile?.id ?? "")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPending((data ?? []) as PendingInv[]));
  useEffect(() => {
    if (profile?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const limit = orgBilling?.exempt ? null : orgBilling?.plan?.trainer_limit ?? null;
  const used = trainerCount + pending.length;
  const full = limit != null && used >= limit;

  const send = async () => {
    if (!profile?.organization_id || !name.trim()) return;
    setSaving(true);
    try {
      const code = await inviteTrainer({ organizationId: profile.organization_id, invitedBy: profile.id, fullName: name.trim(), email: email.trim(), phone: phone.trim() });
      setJustCreated({ name: name.trim(), phone: phone.trim(), link: linkFor(code) });
      setName("");
      setEmail("");
      setPhone("");
      load();
    } catch (e: any) {
      notify(/row-level security|permission/i.test(e.message ?? "") ? "Para invitar entrenadores falta correr part4e_migration.sql, o no figuras como dueño del estudio." : e.message);
    }
    setSaving(false);
  };

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3>Entrenadores de tu estudio</h3>
        <span className="note">
          {trainerCount} {trainerCount === 1 ? "entrenador" : "entrenadores"}
          {pending.length ? ` + ${pending.length} ${pending.length === 1 ? "invitación pendiente" : "invitaciones pendientes"}` : ""}
          {limit != null ? ` · tu plan permite ${limit}` : ""}
        </span>
      </div>
      <div className="bd" style={{ display: "grid", gap: 12 }}>
        {justCreated && (
          <div className="studio-inv-ok">
            <b>Invitación lista para {justCreated.name}.</b>
            <span className="note">Mándale el enlace para que cree su cuenta. Entra directo a tu estudio, con sus propios alumnos.</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <WhatsAppButton phone={justCreated.phone || null} label="Enviar por WhatsApp" text={msgFor(justCreated.name, justCreated.link)} />
              <button
                className="btn ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(justCreated.link);
                  notify("Enlace copiado.");
                }}
              >
                Copiar enlace
              </button>
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <div className="field-label">Invitaciones sin usar</div>
            {pending.map((p) => (
              <div key={p.id} className="studio-inv-row">
                <span style={{ flex: 1 }}>
                  <b>{p.full_name ?? "Sin nombre"}</b>
                  {p.email && <span className="note"> · {p.email}</span>}
                </span>
                <WhatsAppButton small label="Reenviar" text={msgFor(p.full_name ?? "", linkFor(p.code))} />
                <button
                  className="link-btn"
                  style={{ fontSize: 13 }}
                  onClick={async () => {
                    await supabase.from("invitations").update({ status: "revoked" }).eq("id", p.id);
                    load();
                    notify("Invitación cancelada.");
                  }}
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}

        {full ? (
          <p className="note" style={{ margin: 0 }}>
            Llegaste al límite de entrenadores de tu plan ({limit}). Para sumar más, escríbenos para cambiar de plan.
          </p>
        ) : !open ? (
          <button className="btn" style={{ justifySelf: "start" }} onClick={() => { setOpen(true); setJustCreated(null); }}>
            + Invitar entrenador
          </button>
        ) : (
          <div className="studio-inv-form">
            <div>
              <label className="field-label">Nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ana Torrez" />
            </div>
            <div>
              <label className="field-label">Correo (opcional)</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="field-label">WhatsApp (opcional)</label>
              <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 71234567" />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button className="btn" onClick={send} disabled={saving || !name.trim()}>{saving ? "Creando…" : "Crear invitación"}</button>
              <button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
