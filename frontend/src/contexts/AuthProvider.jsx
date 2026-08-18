import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setUnauthorizedHandler } from "../services/api.js";
import {
  deleteAccount as deleteAccountRequest,
  getCurrentUser,
  login,
  logout,
  register,
} from "../services/authService.js";
import { AuthContext } from "./AuthContext.js";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate("/login", { replace: true });
    });

    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    let isStale = false;

    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!isStale) setUser(currentUser);
      } catch {
        if (!isStale) setUser(null);
      } finally {
        if (!isStale) setIsChecking(false);
      }
    };

    checkAuth();

    return () => {
      isStale = true;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    await login(email, password);
    setUser(await getCurrentUser());
  }, []);

  const signUp = useCallback(async (payload) => {
    await register(
      payload.email,
      payload.password,
      payload.password2,
      payload.firstName,
      payload.lastName,
      payload.username,
    );
    setUser(await getCurrentUser());
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  }, []);

  const deleteAccount = useCallback(
    async (currentPassword) => {
      await deleteAccountRequest(currentPassword);
      setUser(null);
      navigate("/login", { replace: true });
    },
    [navigate],
  );

  const value = useMemo(
    () => ({ user, isChecking, signIn, signUp, signOut, deleteAccount }),
    [user, isChecking, signIn, signUp, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
