import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <nav className="flex items-center justify-between border-b border-border bg-bg/85 px-5 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-extrabold">
          <LogoMark size={24} />
          CivicLens
        </div>

        <div className="flex gap-0.5 rounded-xl bg-surface p-0.5">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/chat" className={linkClass}>
            Chat
          </NavLink>
          <NavLink to="/library" className={linkClass}>
            Library
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-ink-soft">{user?.name}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}