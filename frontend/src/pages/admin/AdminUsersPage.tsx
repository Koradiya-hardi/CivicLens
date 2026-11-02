import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdminUser } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/dates";
import { useDebounced } from "@/hooks/useDebounced";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusPill } from "@/components/admin/StatusPill";

type RoleFilter = "" | "user" | "admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const search = useDebounced(q.trim(), 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users", { params: { q: search || undefined, role: role || undefined, page } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load users."));
    } finally {
      setLoading(false);
    }
  }, [search, role, page]);

  useEffect(() => {
    load();
  }, [load]);

  // A new search or filter starts again from page 1.
  useEffect(() => {
    setPage(1);
  }, [search, role]);

  const changeRole = async (user: AdminUser, next: "user" | "admin") => {
    setBusyId(user.id);
    setNotice(null);
    setError(null);
    try {
      const res = await api.patch(`/admin/users/${user.id}/role`, { role: next });
      setUsers((list) => list.map((u) => (u.id === user.id ? res.data.user : u)));
      setNotice(`${user.name} is now ${next === "admin" ? "an admin" : "a regular user"}.`);
    } catch (e) {
      setError(errorMessage(e)); // e.g. "There must always be at least one admin."
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/users/${toDelete.id}`);
      setNotice(`Deleted ${toDelete.name}.`);
      setToDelete(null);
      await load();
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
          placeholder="Search by name or email…"
          className="min-w-60 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          aria-label="Filter by role"
          className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {notice && (
        <div role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-170 text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Conversations</th>
              <th className="px-4 py-3 font-semibold">Last active</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className={busyId === u.id ? "opacity-60" : undefined}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">
                    {u.name} {u.isSelf && <span className="ml-1 text-xs font-normal text-ink-faint">(you)</span>}
                  </div>
                  <div className="text-xs text-ink-soft">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={u.role === "admin" ? "good" : "neutral"}>{u.role === "admin" ? "Admin" : "User"}</StatusPill>
                </td>
                <td className="px-4 py-3 text-ink-soft">{u.conversationCount}</td>
                <td className="px-4 py-3 text-ink-soft">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Never"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {u.isSelf ? (
                      <span className="text-xs text-ink-faint">You can't change your own account</span>
                    ) : (
                      <>
                        <button
                          onClick={() => changeRole(u, u.role === "admin" ? "user" : "admin")}
                          disabled={busyId === u.id}
                          aria-label={`${u.role === "admin" ? "Remove admin from" : "Make admin"} ${u.name}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                        >
                          {u.role === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(u);
                          }}
                          disabled={busyId === u.id}
                          aria-label={`Delete ${u.name}`}
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-faint">
                  No one matches that search.
                </td>
              </tr>
            )}
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-faint">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} onChange={setPage} />

      {toDelete && (
        <ConfirmDialog
          title={`Delete ${toDelete.name}?`}
          confirmLabel="Delete account"
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          This permanently removes <strong className="text-ink">{toDelete.email}</strong> along with their conversations, saved
          resources and deadlines. Their past questions stay in the usage statistics, but no longer point to them. This can't be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
