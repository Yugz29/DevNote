import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useAuth } from "../contexts/AuthContext.js";
import "../styles/auth.css";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState("Connexion");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setSubmitLabel("Signing in");

    try {
      await signIn(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.non_field_errors?.[0] ||
          error.response?.data?.detail ||
          "Invalid email or password",
      );
    } finally {
      setIsSubmitting(false);
      setSubmitLabel("Sign in");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <Link
            to="/"
            className="auth-title"
            style={{ textDecoration: "none" }}
          >
            Dev<span style={{ color: "var(--accent-primary)" }}>Note</span>
          </Link>
          <p className="auth-subtitle">
            Your dev knowledge, everywhere, instantly
          </p>
        </div>

        <div className="auth-card">
          <h2 className="auth-card-title">Connexion</h2>

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="email@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <p className="auth-error">{errorMessage}</p>

            <button type="submit" className="btn-auth" disabled={isSubmitting}>
              {submitLabel}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>

      <ThemeToggle />
    </div>
  );
}
