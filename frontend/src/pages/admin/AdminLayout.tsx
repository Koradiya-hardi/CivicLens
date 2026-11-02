import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users", end: false },
  { to: "/admin/documents", label: "Documents", end: false },
  { to: "/admin/health", label: "System health", end: false },
];

/** Shell for every /admin page: heading + tab bar, with the active page in <Outlet/>. */
export default function AdminLayout() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Admin</h1>
        <p className="mt-1 text-sm text-ink-soft">Manage people and documents, and see how CivicLens is being used.</p>

        <nav aria-label="Admin sections" className="mt-5 flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
