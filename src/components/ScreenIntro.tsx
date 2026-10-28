import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "../routes/paths";

/**
 * La primera vez que alguien entra a una pantalla, un recuadro corto arriba
 * le cuenta para qué sirve y qué hacer primero. Se cierra con "Entendido" y
 * no vuelve a aparecer para esa persona en ese dispositivo.
 *
 * Los textos van acá, por dirección. Para sumar una pantalla, agregar su
 * línea en INTROS. Si se cambia cómo funciona una pantalla, revisar su texto.
 */
const INTROS: Record<string, { title: string; text: string }> = {
  [paths.trainerClients]: {
    title: "Tus alumnos",
    text: "Con \u201cInvitar cliente\u201d creas su ficha y un enlace para que se registre. Tocando un alumno ves su ficha, su formulario de ingreso y tus notas privadas.",
  },
  [paths.trainerRunSession]: {
    title: "Entrenar con un cliente",
    text: "Para cuando entrenas junto a un alumno: lo eliges, abres su rutina de hoy y cargas cada serie desde tu celular. Queda registrado igual que si la hubiera cargado él.",
  },
  [paths.trainerAgenda]: {
    title: "Tu agenda",
    text: "Tus citas presenciales u online, por día o por semana. Una cita se puede repetir todas las semanas.",
  },
  [paths.trainerMessages]: {
    title: "Mensajes",
    text: "Las conversaciones con tus alumnos. Cada uno te escribe desde su app y tú respondes desde acá.",
  },
  [paths.trainerBuilder]: {
    title: "Constructor de rutinas",
    text: "Acá armas la rutina de cada día: eliges el alumno y la semana, y agregas ejercicios con sus series, repeticiones, carga y descanso. También puedes armar biseries y dejar una nota en una serie puntual.",
  },
  [paths.trainerPrograms]: {
    title: "Planificación",
    text: "El plan completo de cada alumno, por semanas y bloques. Empieza eligiendo un alumno; después armas cada día en el Constructor de rutinas.",
  },
  [paths.trainerTemplates]: {
    title: "Plantillas",
    text: "Programas y rutinas guardados para reutilizar: en vez de empezar de cero con cada alumno, aplicas una plantilla y la ajustas.",
  },
  [paths.trainerExercises]: {
    title: "Ejercicios",
    text: "Tu biblioteca de ejercicios. Además de los de FuerzaLab, puedes crear los tuyos o importarlos desde Excel.",
  },
  [paths.trainerAssessments]: {
    title: "Evaluaciones",
    text: "Las mediciones de cada alumno: datos corporales, circunferencias, pliegues, fuerza, movilidad y fotos. Elige el alumno y la fecha, y carga solo lo que mediste.",
  },
  [paths.trainerWellness]: {
    title: "Bienestar",
    text: "Lo que tus alumnos responden antes de entrenar —sueño, energía, estrés y dolor— con un semáforo. Si alguien llega en rojo, ajusta la sesión del día.",
  },
  [paths.trainerProgressPhotos]: {
    title: "Fotos de progreso",
    text: "Las fotos de cada alumno para comparar antes y ahora. Las que sube el alumno también aparecen acá.",
  },
  [paths.trainerReports]: {
    title: "Reportes",
    text: "La evolución de cada alumno en gráficos: fuerza, medidas, bienestar y asistencia. Se exporta en PDF con tu marca.",
  },
  [paths.trainerSuggestions]: {
    title: "Sugerencias",
    text: "Recomendaciones que la app calcula a partir de lo que registran tus alumnos, para ayudarte a decidir el próximo paso.",
  },
  [paths.trainerPayments]: {
    title: "Pagos",
    text: "Tus planes y los cobros de cada alumno: quién pagó, a quién le vence pronto y quién debe.",
  },
  [paths.trainerTeam]: {
    title: "Equipo",
    text: "Si trabajas con asistentes, los invitas acá y eliges qué secciones ve cada uno y qué alumnos les asignas.",
  },
  [paths.clientRoutine]: {
    title: "Tu rutina",
    text: "Abre la rutina de hoy y carga cada serie a medida que la haces. Al terminar, cuéntale a tu entrenador cómo te sentiste.",
  },
  [paths.clientWellness]: {
    title: "Bienestar",
    text: "Antes de entrenar, cuéntale a tu entrenador cómo llegas: sueño, energía, estrés y si te duele algo. Toma unos 20 segundos.",
  },
  [paths.clientReports]: {
    title: "Tus reportes",
    text: "Tu evolución en gráficos: fuerza, medidas y asistencia. Mira cuánto mejoraste desde que empezaste.",
  },
};

export default function ScreenIntro() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const intro = INTROS[pathname];
  const key = `fl-intro-${profile?.id ?? ""}-${pathname}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!intro || !profile) return setHidden(true);
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(true); // sin almacenamiento, mejor no mostrar algo que no se puede cerrar para siempre
    }
  }, [key, intro, profile]);

  if (!intro || hidden) return null;

  return (
    <div className="screen-intro" role="note">
      <Info size={18} style={{ flex: "none", marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <b>{intro.title}</b>
        <p>{intro.text}</p>
      </div>
      <button
        className="btn ghost"
        style={{ padding: "5px 12px", fontSize: 13, flex: "none" }}
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* nada */
          }
        }}
      >
        Entendido
      </button>
    </div>
  );
}
