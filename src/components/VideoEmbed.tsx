import { useEffect, useRef, useState } from "react";
import { parseVideoUrl, youtubeErrorReason, checkVideoAvailable } from "../lib/videoEmbed";
import { reportExerciseVideoBroken } from "../services/exercises";

/**
 * Reproductor de un video de YouTube o Vimeo DENTRO de la app.
 * - YouTube con el dominio sin cookies de seguimiento y, al terminar, sin
 *   sugerir videos de otros canales.
 * - Si el video no está disponible, muestra un aviso en vez de una pantalla
 *   en negro y le avisa al entrenador (queda marcado en el ejercicio).
 */
let ytApi: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if ((window as any).YT?.Player) return Promise.resolve((window as any).YT);
  if (!ytApi) {
    ytApi = new Promise((resolve) => {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve((window as any).YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

export default function VideoEmbed({ url, exerciseId, onBroken }: { url: string; exerciseId?: string; onBroken?: (reason: string) => void }) {
  const parsed = parseVideoUrl(url);
  const holder = useRef<HTMLDivElement>(null);
  const [broken, setBroken] = useState<string | null>(null);

  const markBroken = (reason: string) => {
    setBroken(reason);
    onBroken?.(reason);
    if (exerciseId) reportExerciseVideoBroken(exerciseId, reason).catch(() => {});
  };

  useEffect(() => {
    setBroken(null);
    if (!parsed) return;
    let player: any = null;
    let alive = true;
    if (parsed.provider === "youtube") {
      loadYouTubeApi().then((YT) => {
        if (!alive || !holder.current) return;
        const target = document.createElement("div");
        holder.current.innerHTML = "";
        holder.current.appendChild(target);
        player = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId: parsed.id,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onError: (e: any) => {
              const reason = youtubeErrorReason(e.data);
              if (reason) markBroken(reason);
            },
          },
        });
      });
    } else {
      // Vimeo: se comprueba antes de mostrarlo (si no está, no hay reproductor que muestre el error).
      checkVideoAvailable(parsed).then((r) => {
        if (alive && !r.ok) markBroken(r.reason ?? "El video no está disponible");
      });
    }
    return () => {
      alive = false;
      try {
        player?.destroy?.();
      } catch {
        /* nada */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!parsed) return <p className="note">El enlace no es de YouTube ni de Vimeo.</p>;
  if (broken) {
    return (
      <div className="video-broken" role="status">
        <b>Este video no está disponible por ahora.</b>
        <span>{broken}. Ya le avisamos a tu entrenador.</span>
      </div>
    );
  }
  return (
    <div className="video-embed">
      {parsed.provider === "youtube" ? (
        <div ref={holder} className="video-frame" />
      ) : (
        <iframe
          className="video-frame"
          src={`https://player.vimeo.com/video/${parsed.id}?dnt=1&title=0&byline=0&portrait=0`}
          title="Video del ejercicio"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
