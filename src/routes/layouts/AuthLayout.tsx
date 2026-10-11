import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          Fuerza<span>Lab</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
