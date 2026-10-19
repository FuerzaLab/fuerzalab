import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  CalendarRange,
  Lightbulb,
  CreditCard,
  MessageSquare,
  FileText,
  Settings,
  Building2,
  LogOut,
  Home,
  Activity,
  Ruler,
  Camera,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../paths";
import type { Role } from "../../types/auth";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group?: string;
}

const NAV: Record<Role, NavItem[]> = {
  super_admin: [
    { to: paths.adminDashboard, label: "Panel", icon: LayoutDashboard },
    { to: paths.adminOrgs, label: "Organizaciones", icon: Building2 },
    { to: paths.adminUsers, label: "Usuarios", icon: Users },
    { to: paths.adminExercises, label: "Ejercicios globales", icon: Dumbbell },
    { to: paths.adminBilling, label: "Pagos", icon: CreditCard },
    { to: paths.adminSettings, label: "Configuración", icon: Settings },
  ],
  trainer: [
    { to: paths.trainerDashboard, label: "Inicio", icon: LayoutDashboard, group: "Hoy" },
    { to: paths.trainerRunSession, label: "Entrenar con cliente", icon: Dumbbell, group: "Hoy" },

    { to: paths.trainerClients, label: "Clientes", icon: Users, group: "Clientes" },
    { to: paths.trainerMessages, label: "Mensajes", icon: MessageSquare, group: "Clientes" },

    { to: paths.trainerExercises, label: "Ejercicios", icon: Dumbbell, group: "Entrenamiento" },
    { to: paths.trainerBuilder, label: "Constructor de rutinas", icon: ClipboardList, group: "Entrenamiento" },
    { to: paths.trainerPrograms, label: "Planificación", icon: CalendarRange, group: "Entrenamiento" },
    { to: paths.trainerAssessments, label: "Evaluaciones", icon: Ruler, group: "Entrenamiento" },
    { to: paths.trainerWellness, label: "Bienestar", icon: Activity, group: "Entrenamiento" },
    { to: paths.trainerProgressPhotos, label: "Fotos", icon: Camera, group: "Entrenamiento" },

    { to: paths.trainerReports, label: "Reportes", icon: FileText, group: "Seguimiento" },
    { to: paths.trainerSuggestions, label: "Sugerencias", icon: Lightbulb, group: "Seguimiento" },

    { to: paths.trainerPayments, label: "Pagos", icon: CreditCard, group: "Negocio" },
    { to: paths.trainerSettings, label: "Configuración", icon: Settings, group: "Negocio" },
  ],
  staff: [
    { to: paths.trainerDashboard, label: "Inicio", icon: LayoutDashboard },
    { to: paths.trainerClients, label: "Clientes", icon: Users },
    { to: paths.trainerMessages, label: "Mensajes", icon: MessageSquare },
  ],
  client: [
    { to: paths.clientDashboard, label: "Inicio", icon: Home },
    { to: paths.clientRoutine, label: "Mi rutina", icon: Dumbbell },
    { to: paths.clientProgress, label: "Mi progreso", icon: Activity },
    { to: paths.clientWellness, label: "Bienestar", icon: Ruler },
    { to: paths.clientReports, label: "Mis reportes", icon: FileText },
    { to: paths.clientPayments, label: "Pagos", icon: CreditCard },
    { to: paths.clientMessages, label: "Mensajes", icon: MessageSquare },
  ],
};

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  const items = NAV[profile.role];

  const handleLogout = async () => {
    if (!window.confirm("¿Cerrar sesión?")) return;
    await signOut();
    navigate(paths.login, { replace: true });
  };

  return (
    <div className="shell">
      <nav className="side" aria-label="Navegación principal">
        <div className="brand">
          Fuerza<span>Lab</span>
        </div>
        {items.map(({ to, label, icon: Icon, group }, i) => (
          <div key={to} className="nav-item">
            {group && group !== items[i - 1]?.group && <div className="nav-group">{group}</div>}
            <NavLink to={to} end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon size={18} /> {label}
            </NavLink>
          </div>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.14)", marginTop: 10, paddingTop: 10 }}>
          <button className="nav-link" onClick={handleLogout} style={{ border: 0 }}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <span className="note">
            {profile.full_name} · {roleLabel(profile.role)}
          </span>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

function roleLabel(role: Role): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "trainer":
      return "Entrenador";
    case "staff":
      return "Staff";
    case "client":
      return "Cliente";
  }
}
