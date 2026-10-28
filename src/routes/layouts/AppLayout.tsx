import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Copy,
  CalendarClock,
  Menu,
  X,
  UserCog,
  Sparkles,
  Eye,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../paths";
import type { Role, StaffAccess } from "../../types/auth";
import { routeRequirement, hasLevel } from "../../lib/staffModules";
import Brand from "../../components/ui/Brand";
import DemoGate from "../../components/DemoGate";
import PageLoading from "../../components/ui/PageLoading";
import { useIsStudioOwner } from "../../hooks/useIsStudioOwner";
import { useWhatsNew } from "../../hooks/useWhatsNew";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group?: string;
  accent?: "wellness";
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
    { to: paths.trainerAgenda, label: "Agenda", icon: CalendarClock, group: "Hoy" },

    { to: paths.trainerClients, label: "Clientes", icon: Users, group: "Clientes" },
    { to: paths.trainerMessages, label: "Mensajes", icon: MessageSquare, group: "Clientes" },

    { to: paths.trainerExercises, label: "Ejercicios", icon: Dumbbell, group: "Entrenamiento" },
    { to: paths.trainerBuilder, label: "Constructor de rutinas", icon: ClipboardList, group: "Entrenamiento" },
    { to: paths.trainerPrograms, label: "Planificación", icon: CalendarRange, group: "Entrenamiento" },
    { to: paths.trainerTemplates, label: "Plantillas", icon: Copy, group: "Entrenamiento" },
    { to: paths.trainerAssessments, label: "Evaluaciones", icon: Ruler, group: "Entrenamiento" },
    { to: paths.trainerWellness, label: "Bienestar", icon: Activity, group: "Entrenamiento", accent: "wellness" },
    { to: paths.trainerProgressPhotos, label: "Fotos", icon: Camera, group: "Entrenamiento" },

    { to: paths.trainerReports, label: "Reportes", icon: FileText, group: "Seguimiento" },
    { to: paths.trainerSuggestions, label: "Sugerencias", icon: Lightbulb, group: "Seguimiento" },

    { to: paths.trainerPayments, label: "Pagos", icon: CreditCard, group: "Negocio" },
    { to: paths.trainerStudio, label: "Tu estudio", icon: Building2, group: "Negocio" },
    { to: paths.trainerTeam, label: "Equipo", icon: UserCog, group: "Negocio" },
    { to: paths.trainerSettings, label: "Configuración", icon: Settings, group: "Negocio" },
    { to: paths.trainerWhatsNew, label: "Qué hay de nuevo", icon: Sparkles, group: "Negocio" },
  ],
  // El menú del staff se arma a partir del del entrenador, filtrado según
  // los permisos que le dio (ver staffNav más abajo).
  staff: [],
  client: [
    { to: paths.clientDashboard, label: "Inicio", icon: Home },
    { to: paths.clientRoutine, label: "Mi rutina", icon: Dumbbell },
    { to: paths.clientProgress, label: "Mi progreso", icon: Activity },
    { to: paths.clientWellness, label: "Bienestar", icon: Ruler, accent: "wellness" },
    { to: paths.clientAssessments, label: "Mis evaluaciones", icon: ClipboardList },
    { to: paths.clientReports, label: "Mis reportes", icon: FileText },
    { to: paths.clientPayments, label: "Pagos", icon: CreditCard },
    { to: paths.clientMessages, label: "Mensajes", icon: MessageSquare },
    { to: paths.clientWhatsNew, label: "Qué hay de nuevo", icon: Sparkles },
  ],
};

// Un color por grupo (no por botón) para que el menú del entrenador no se
// vuelva un arcoíris — Bienestar es la única excepción, con el mismo
// violeta que ya usa en el resto de la app.
const GROUP_COLOR: Record<string, { bg: string; fg: string }> = {
  Hoy: { bg: "#E5EAF8", fg: "#1E3FA8" },
  Clientes: { bg: "#FBE4EC", fg: "#C23A68" },
  Entrenamiento: { bg: "#E1F1EA", fg: "#1F6B52" },
  Seguimiento: { bg: "#FBF0D6", fg: "#9A6300" },
  Negocio: { bg: "#E6E9F7", fg: "#3A4A9E" },
};
const WELLNESS_COLOR = { bg: "#EDE7FB", fg: "#7B4FE0" };

/** Las secciones del entrenador que este asistente tiene habilitadas. */
function staffNav(access: StaffAccess | null): NavItem[] {
  if (!access) return [];
  return NAV.trainer.filter((item) => {
    if (item.to === paths.trainerTeam || item.to === paths.trainerStudio) return false;
    const req = routeRequirement(item.to);
    if (!req) return true;
    return hasLevel(access.permissions, req.module, req.level) && (!req.extra || hasLevel(access.permissions, req.extra, "read"));
  });
}

export default function AppLayout() {
  const { profile, signOut, staffAccess } = useAuth();
  const navigate = useNavigate();
  const isOwner = useIsStudioOwner();
  const { unseenCount } = useWhatsNew();

  if (!profile) return null;

  // "Tu estudio" solo aparece para el dueño del estudio.
  const items =
    profile.role === "staff"
      ? staffNav(staffAccess)
      : profile.role === "trainer" && !isOwner
        ? NAV.trainer.filter((i) => i.to !== paths.trainerStudio)
        : NAV[profile.role];

  const handleLogout = async () => {
    if (!window.confirm("¿Cerrar sesión?")) return;
    await signOut();
    navigate(paths.login, { replace: true });
  };

  if (profile.role === "trainer" || profile.role === "staff") {
    const roleText =
      profile.role === "staff" ? `Asistente de ${staffAccess?.trainerName ?? "tu entrenador"}` : "Entrenador";
    return (
      <TrainerLauncherShell
        items={items}
        profileName={profile.full_name}
        roleText={roleText}
        staffAccess={profile.role === "staff" ? staffAccess : null}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="Navegación principal">
        <Brand />
        {items.map(({ to, label, icon: Icon, group, accent }, i) => (
          <div key={to} className="nav-item">
            {group && group !== items[i - 1]?.group && <div className="nav-group">{group}</div>}
            <NavLink
              to={to}
              end
              className={({ isActive }) => `nav-link${accent === "wellness" ? " nav-link-wellness" : ""}${isActive ? " active" : ""}`}
            >
              <Icon size={18} /> {label}
              {(to === paths.clientWhatsNew || to === paths.trainerWhatsNew) && unseenCount > 0 && <span className="nav-dot" aria-label="Hay novedades" />}
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
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * El menú del entrenador, como "ventana" que se abre con un click en
 * "Menú" (igual en computadora y celular, nunca por cercanía del mouse) y
 * se cierra sola al elegir algo. Reemplaza la barra lateral fija, que acá
 * tenía 16 ítems — demasiados para quedar siempre visibles sin ocupar
 * espacio todo el tiempo.
 */
function TrainerLauncherShell({
  items,
  profileName,
  roleText,
  staffAccess,
  onLogout,
}: {
  items: NavItem[];
  profileName: string;
  roleText: string;
  staffAccess: StaffAccess | null;
  onLogout: () => void;
}) {
  const { unseenCount } = useWhatsNew();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Aviso de solo lectura: el staff con permiso "Solo ver" en esta sección
  // ve los mismos botones que el entrenador, pero la base de datos no le
  // deja guardar — mejor avisarlo arriba que dejar que lo descubra.
  const req = staffAccess ? routeRequirement(pathname) : null;
  const readOnly = !!(staffAccess && req && !hasLevel(staffAccess.permissions, req.module, "write"));
  const close = () => setOpen(false);

  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const groupName = item.group ?? "";
    let g = groups.find((x) => x.name === groupName);
    if (!g) {
      g = { name: groupName, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <div className="shell-launcher">
      <header className="launcher-topbar">
        <Brand />
        <button className="menu-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Menu size={17} /> Menú
          {unseenCount > 0 && <span className="wn-dot" aria-label="Hay novedades en Qué hay de nuevo" />}
        </button>
      </header>

      <header className="topbar">
        <span className="note">{profileName} · {roleText}</span>
      </header>

      <main>
        {readOnly && (
          <div className="readonly-banner" role="status">
            <Eye size={15} /> Tienes acceso de <strong>solo lectura</strong> a esta sección: puedes ver todo, pero los cambios no se van a guardar.
          </div>
        )}
        <DemoGate>
          <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
        </DemoGate>
      </main>

      <div className={`menu-overlay${open ? " open" : ""}`} onClick={close} aria-hidden={!open} />
      <div className={`menu-panel${open ? " open" : ""}`} role="dialog" aria-label="Menú principal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, color: "var(--ink)" }}>Menú</h2>
          <button
            aria-label="Cerrar menú"
            onClick={close}
            style={{ width: 30, height: 30, borderRadius: 99, border: 0, background: "var(--bg)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={14} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.name || "default"}>
            {g.name && <p className="menu-group-title" style={{ color: GROUP_COLOR[g.name]?.fg ?? "var(--pri)" }}>{g.name}</p>}
            <div className="menu-grid">
              {g.items.map(({ to, label, icon: Icon, accent }) => {
                const color = accent === "wellness" ? WELLNESS_COLOR : GROUP_COLOR[g.name] ?? GROUP_COLOR.Hoy;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={close}
                    className={({ isActive }) => `menu-tile${isActive ? " active" : ""}`}
                    style={{ background: color.bg, color: color.fg }}
                  >
                    <span className="ic" style={{ background: color.fg }}>
                      <Icon size={18} />
                    </span>
                    <span className="lbl">
                      {label}
                      {to === paths.trainerWhatsNew && unseenCount > 0 && <span className="nav-dot" aria-label="Hay novedades" />}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        <button className="menu-logout" onClick={onLogout}>
          <LogOut size={16} /> Cerrar sesión
        </button>
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
      return "Asistente";
    case "client":
      return "Cliente";
  }
}
