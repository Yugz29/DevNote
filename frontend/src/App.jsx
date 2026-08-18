import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.js";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

function RequireAuth({ children }) {
  const { user, isChecking } = useAuth();

  if (isChecking) return null;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

function RootRedirect() {
  const { user, isChecking } = useAuth();

  if (isChecking) return null;

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
