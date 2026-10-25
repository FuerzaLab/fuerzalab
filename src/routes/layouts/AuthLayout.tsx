import { Outlet } from "react-router-dom";
import Brand from "../../components/ui/Brand";

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Brand className="auth-brand" />
        <Outlet />
      </div>
    </div>
  );
}
