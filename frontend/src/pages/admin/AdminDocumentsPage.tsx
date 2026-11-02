import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { CATEGORIES, type AdminResource } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { timeAgo } from "@/lib/dates";
import { useDebounced } from "@/hooks/useDebounced";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusPill } from "@/components/admin/StatusPill";

type StatusFilter = "" | "published" | "draft";

export default function AdminDocumentsPage() {
  const [items, setItems] = useState<AdminResource[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const search = useDebounced(q.trim(), 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/resources", {
        params: { q: search || undefined, status: status || undefined, category: category || undefined, page },
      });
      setItems(res.data.resources);
      setTotal(res.data.total);
      setPages(res.data.pages);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load documents."));
    } finally {
      setLoading(false);
    }
  }, [search, status, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

  const replace = (updated: AdminResource) => setItems((list) => list.map((r) => (r.id === updated.id ? updated : r)));

  const togglePublished = async (r: AdminResource) => {
    setBusyId(r.id);
    setNotice(null);
    setError(null);
    try {
      const res = await api.patch(`/admin/resources/${r.id}/publish`, { isPublished: !r.isPublished });
      replace(res.data.resource);
      setNotice(
        res.data.needsIndexing
          ? `"${r.title}" is published, but it has no search data yet - click Re-index so people can find it.`
          : `"${r.title}" is now ${res.data.resource.isPublished ? "published" : "a draft (hidden from users)"}.`
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const reindex = async (r: AdminResource) => {
    setBusyId(r.id);
    setNotice(null);
    setError(null);
    try {
      const res = await api.post(`/ingestion/${r.id}`);
      setItems((list) =>
        list.map((x) =>
          x.id === r.id ? { ...x, chunkCount: res.data.chunkCount, searchable: x.isPublished && res.data.chunkCount > 0 } : x
        )
      );
      setNotice(`Re-indexed "${r.title}" - ${res.data.chunkCount} search passage${res.data.chunkCount === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(errorMessage(e, "Re-indexing failed."));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/resources/${toDelete.id}`);
      setNotice(`Deleted "${toDelete.title}".`);
      setToDelete(null);
      await load();
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const selectClass =
    "rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search documents"
          placeholder="Search by title…"
          className="min-w-52 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status" className={selectClass}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className={selectClass}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Link to="/upload" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg">
          Upload document
        </Link>
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
        <table className="w-full min-w-205 text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Visibility</th>
              <th className="px-4 py-3 font-semibold">Search</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((r) => (
              <tr key={r.id} className={busyId === r.id ? "opacity-60" : undefined}>
                <td className="max-w-80 px-4 py-3">
                  <div className="truncate font-semibold text-ink" title={r.title}>
                    {r.title}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {r.category}
                    {r.fileName ? ` · ${r.fileName} (${formatBytes(r.fileSize)})` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={r.isPublished ? "good" : "neutral"}>{r.isPublished ? "Published" : "Draft"}</StatusPill>
                </td>
                <td className="px-4 py-3">
                  {r.searchable ? (
                    <StatusPill tone="good">Searchable · {r.chunkCount}</StatusPill>
                  ) : r.chunkCount === 0 ? (
                    <StatusPill tone={r.isPublished ? "warn" : "neutral"}>Not indexed</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Indexed · {r.chunkCount} (hidden)</StatusPill>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{timeAgo(r.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => togglePublished(r)}
                      disabled={busyId === r.id}
                      aria-label={`${r.isPublished ? "Unpublish" : "Publish"} ${r.title}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                    >
                      {r.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => reindex(r)}
                      disabled={busyId === r.id}
                      aria-label={`Re-index ${r.title}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                    >
                      Re-index
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setToDelete(r);
                      }}
                      disabled={busyId === r.id}
                      aria-label={`Delete ${r.title}`}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-faint">
                  No documents match. Use "Upload document" to add one.
                </td>
              </tr>
            )}
            {loading && items.length === 0 && (
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
          title={`Delete "${toDelete.title}"?`}
          confirmLabel="Delete document"
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          This removes the document, its {toDelete.chunkCount} search passage{toDelete.chunkCount === 1 ? "" : "s"}, everyone's
          saved copies of it, and the uploaded file. This can't be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
