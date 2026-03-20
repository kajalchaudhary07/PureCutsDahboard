import { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthProvider";

const initialRegister = { name: "", email: "", password: "", confirmPassword: "" };
const initialLogin = { email: "", password: "" };

export default function AuthPage() {
  const { user, authLoading, isAdmin, loginWithEmail, registerWithEmail, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [forgotEmail, setForgotEmail] = useState("");
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname;
    return from && from !== "/auth" ? from : "/products";
  }, [location.state]);

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    );
  }

  if (user && isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  const onLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });
      toast.success("Signed in successfully");
    } catch (error) {
      toast.error(error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (e) => {
    e.preventDefault();

    if (!registerForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!registerForm.email.trim() || !registerForm.password) {
      toast.error("Email and password are required");
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({
        name: registerForm.name.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
      });
      toast.success("Account created. Ask super admin to grant admin access.");
      setMode("login");
      setRegisterForm(initialRegister);
    } catch (error) {
      toast.error(error?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async (e) => {
    e.preventDefault();
    const emailToReset = String(forgotEmail || loginForm.email || "").trim();
    if (!emailToReset) {
      toast.error("Please enter your email to reset password");
      return;
    }

    setForgotLoading(true);
    try {
      await requestPasswordReset(emailToReset);
      toast.success("Password reset link sent. Please check your email inbox.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (error) {
      toast.error(error?.message || "Could not send password reset email");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>PureCuts Dashboard</h1>
        <p className="auth-subtitle">Secure admin access for catalog operations</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={onLogin} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="auth-forgot-row">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setForgotOpen((prev) => !prev);
                  if (!forgotEmail && loginForm.email) {
                    setForgotEmail(loginForm.email);
                  }
                }}
              >
                Forgot Password?
              </button>
            </div>

            {forgotOpen ? (
              <div className="auth-forgot-box">
                <label>Reset password email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  className="btn btn-outline auth-reset-btn"
                  disabled={forgotLoading}
                  onClick={onForgotPassword}
                >
                  {forgotLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            ) : null}
          </form>
        ) : (
          <form onSubmit={onRegister} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={registerForm.name}
                onChange={(e) =>
                  setRegisterForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Your name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) =>
                  setRegisterForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="At least 6 characters"
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(e) =>
                  setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }))
                }
                placeholder="Retype password"
              />
            </div>
            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>
        )}

        {user && !isAdmin && (
          <div className="auth-note">
            You are signed in, but admin access is pending. Ask a super admin to assign admin role.
          </div>
        )}
      </div>
    </div>
  );
}
