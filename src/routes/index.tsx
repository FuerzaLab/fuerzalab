import { Routes, Route } from "react-router-dom";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";
import RequireRole from "./guards/RequireRole";
import RoleRedirect from "./RoleRedirect";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import NoAccess from "../pages/shared/NoAccess";
import NotFound from "../pages/shared/NotFound";
import ComingSoon from "../pages/shared/ComingSoon";

import AdminDashboard from "../pages/admin/Dashboard";
import TrainerDashboard from "../pages/trainer/Dashboard";
import ClientDashboard from "../pages/client/Dashboard";

import { paths } from "./paths";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Autenticación: públicas */}
      <Route element={<AuthLayout />}>
        <Route path={paths.login} element={<Login />} />
        <Route path={paths.register} element={<Register />} />
        <Route path={paths.forgotPassword} element={<ForgotPassword />} />
        <Route path={paths.resetPassword} element={<ResetPassword />} />
      </Route>

      {/* A partir de aquí, hace falta sesión iniciada */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<RoleRedirect />} />
        <Route path={paths.noAccess} element={<NoAccess />} />

        {/* Super Admin */}
        <Route element={<RequireRole allow={["super_admin"]} />}>
          <Route element={<AppLayout />}>
            <Route path={paths.adminDashboard} element={<AdminDashboard />} />
            <Route path={paths.adminOrgs} element={<ComingSoon title="Organizaciones" />} />
            <Route path={paths.adminUsers} element={<ComingSoon title="Usuarios" />} />
            <Route path={paths.adminExercises} element={<ComingSoon title="Ejercicios globales" />} />
            <Route path={paths.adminSettings} element={<ComingSoon title="Configuración" />} />
          </Route>
        </Route>

        {/* Entrenador y Staff */}
        <Route element={<RequireRole allow={["trainer", "staff"]} />}>
          <Route element={<AppLayout />}>
            <Route path={paths.trainerDashboard} element={<TrainerDashboard />} />
            <Route path={paths.trainerClients} element={<ComingSoon title="Clientes" />} />
            <Route path={paths.trainerExercises} element={<ComingSoon title="Ejercicios" />} />
            <Route path={paths.trainerTemplates} element={<ComingSoon title="Plantillas" />} />
            <Route path={paths.trainerPrograms} element={<ComingSoon title="Planificación" />} />
            <Route path={paths.trainerBuilder} element={<ComingSoon title="Constructor de rutinas" />} />
            <Route path={paths.trainerTracking} element={<ComingSoon title="Seguimiento" />} />
            <Route path={paths.trainerAnalytics} element={<ComingSoon title="Analytics" />} />
            <Route path={paths.trainerSuggestions} element={<ComingSoon title="Sugerencias" />} />
            <Route path={paths.trainerMessages} element={<ComingSoon title="Mensajes" />} />
            <Route path={paths.trainerPayments} element={<ComingSoon title="Pagos" />} />
            <Route path={paths.trainerReports} element={<ComingSoon title="Reportes" />} />
            <Route path={paths.trainerSettings} element={<ComingSoon title="Configuración" />} />
          </Route>
        </Route>

        {/* Cliente */}
        <Route element={<RequireRole allow={["client"]} />}>
          <Route element={<AppLayout />}>
            <Route path={paths.clientDashboard} element={<ClientDashboard />} />
            <Route path={paths.clientRoutine} element={<ComingSoon title="Mi rutina" />} />
            <Route path={paths.clientHistory} element={<ComingSoon title="Historial" />} />
            <Route path={paths.clientProgress} element={<ComingSoon title="Mi progreso" />} />
            <Route path={paths.clientAssessments} element={<ComingSoon title="Evaluaciones" />} />
            <Route path={paths.clientMessages} element={<ComingSoon title="Mensajes" />} />
            <Route path={paths.clientPayments} element={<ComingSoon title="Pagos" />} />
            <Route path={paths.clientProfile} element={<ComingSoon title="Mi perfil" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
