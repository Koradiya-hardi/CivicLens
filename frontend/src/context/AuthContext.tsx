import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "civiclens_token";

/**
 * Wraps the whole app (see main.tsx) so ANY component, anywhere, can call
 * useAuth() to know who's logged in - instead of passing user/token props
 * down through every layer of the component tree by hand ("prop drilling").
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Starts true: on first load we don't yet know if a stored token is
  // still valid - ProtectedRoute (next file) needs to wait for this to
  // resolve before deciding to redirect to /login, otherwise a page
  // refresh would incorrectly bounce a logged-in user for a split second.
  const [loading, setLoading] = useState(true);

  /**
   * On app load: if a token is already sitting in localStorage from a
   * previous session, verify it's still valid by calling GET /auth/me
   * (built in Week 1) and restore the user - this is what makes "stay
   * logged in after refreshing the page" actually work.
   */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.post("/auth/register", { name, email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * The hook every component actually uses: const { user, logout } = useAuth();
 * Throws a clear error if used outside <AuthProvider> - much easier to
 * debug than a silent "user is always undefined" bug.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}