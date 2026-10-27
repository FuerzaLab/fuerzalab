import { useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import ConfirmModal from "./ui/ConfirmModal";
import { isDemoAccount } from "../lib/demo";
import { demoNeedsSeed, seedDemo } from "../services/demoSeed";

/**
 * Envuelve las pantallas del entrenador. Si la cuenta es la demo:
 * - al entrar, si la demo está vacía o sus datos tienen más de ~20 horas,
 *   la vuelve a cargar con datos frescos (relativos a hoy) antes de
 *   mostrar nada, con un aviso de "Preparando la demo…";
 * - muestra arriba un aviso de que es una demo, con un botón para
 *   restablecer los datos de ejemplo cuando se quiera.
 * Para cualquier otra cuenta no hace nada.
 */
export default function DemoGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const isDemo = profile?.role === "trainer" && isDemoAccount(profile.email);
  const [status, setStatus] = useState<"checking" | "seeding" | "ready">(isDemo ? "checking" : "ready");
  const [message, setMessage] = useState("Preparando la demo…");
  const [confirmReset, setConfirmReset] = useState(false);
  const [version, setVersion] = useState(0); // fuerza a remontar las pantallas después de recargar

  const run = async (force: boolean) => {
    if (!profile?.organization_id) return;
    try {
      if (force || (await demoNeedsSeed(profile.id))) {
        setStatus("seeding");
        await seedDemo({ organizationId: profile.organization_id, trainerId: profile.id, onProgress: setMessage });
        setVersion((v) => v + 1);
      }
    } catch (e: any) {
      notify(e.message);
    }
    setStatus("ready");
  };

  useEffect(() => {
    if (isDemo) run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  if (!isDemo) return <>{children}</>;

  if (status !== "ready") {
    return (
      <div className="page">
        <div className="panel" style={{ maxWidth: 460, margin: "40px auto", textAlign: "center" }}>
          <div className="bd" style={{ padding: "30px 22px" }}>
            <Sparkles size={30} style={{ color: "var(--pri)" }} />
            <h2 style={{ margin: "12px 0 6px" }}>Preparando la demo</h2>
            <p className="note" style={{ margin: 0 }}>{status === "checking" ? "Un momento…" : message}</p>
            <p className="note" style={{ fontSize: 12.5, marginTop: 12 }}>Estamos cargando clientes y semanas de entrenamientos de ejemplo. Tarda unos segundos.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="demo-banner" role="status">
        <Sparkles size={15} />
        <span style={{ flex: 1, minWidth: 200 }}>
          Estás en la <strong>demo de FuerzaLab</strong>: los clientes y los datos son de ejemplo. Puedes tocar todo; se restablece solo cada día.
        </span>
        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setConfirmReset(true)}>
          Restablecer datos
        </button>
      </div>
      <div key={version}>{children}</div>
      {confirmReset && (
        <ConfirmModal
          title="Restablecer la demo"
          message="Se borran los cambios que hiciste y se vuelven a cargar los clientes y datos de ejemplo, con fechas de hoy."
          confirmLabel="Restablecer"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            run(true);
          }}
        />
      )}
    </>
  );
}
