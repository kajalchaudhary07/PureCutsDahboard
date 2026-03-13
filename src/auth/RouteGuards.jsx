import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

function AuthLoader() {
  return (
    <div className="auth-loader-wrap">
      <div className="spinner" />
    </div>
  );
}

export function RequireAuth() {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthLoader />;
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { authLoading, isAdmin, logout } = useAuth();

  if (authLoading) return <AuthLoader />;
  if (!isAdmin) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Access restricted</h2>
          <p>
            Your account is signed in, but does not have admin permissions yet.
            Ask a super admin to grant the role, then sign out/sign in again.
          </p>
          <button className="btn btn-primary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
