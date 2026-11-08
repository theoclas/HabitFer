import { isAxiosError } from "axios";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, logout as apiLogout, renewSessionIfNeeded } from "../api/client";
import { clearSession, readSessionUser, saveSessionUser } from "../api/session";
import type { AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  /** Se abrió sin poder preguntarle al servidor: se usa la última sesión de este dispositivo. */
  const fromSavedRef = useRef(false);

  const check = useCallback(async (quiet: boolean) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      setUser(data);
      saveSessionUser(data);
      fromSavedRef.current = false;
      // Cada vez que se abre la app, la sesión queda un año más (como mucho cada 12 horas).
      void renewSessionIfNeeded();
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403) {
        clearSession();
        setUser(null);
        fromSavedRef.current = false;
      } else {
        // Sin señal o con el servidor reiniciándose: no se cierra la sesión, se abre con la última conocida.
        const saved = readSessionUser();
        setUser(saved);
        fromSavedRef.current = saved != null;
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => check(false), [check]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Si se abrió sin señal, al volver la conexión confirma la sesión (y la renueva) sin la ruedita.
  useEffect(() => {
    const onOnline = () => {
      if (fromSavedRef.current) void check(true);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [check]);

  const logout = useCallback(async () => {
    await apiLogout();
    fromSavedRef.current = false;
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
