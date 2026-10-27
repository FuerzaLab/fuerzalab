import { Outlet } from "react-router-dom";
import Brand from "../../components/ui/Brand";
import Watermark from "../../components/ui/Watermark";

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <Watermark />
      <div className="auth-card">
        <Brand className="auth-brand" withOrg={false} />
        <Outlet />
      </div>
    </div>
  );
}
