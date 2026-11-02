import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { CATEGORIES, type ResourceSummary, type SearchHit } from "@/lib/types";
import { ResourceCard } from "@/components/ResourceCard";
import { ResourceModal } from "@/components/ResourceModal";

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  const [browse, setBrowse] = useState<ResourceSummary[]>([]);
  // null = browsing everything; an array = showing search results.
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await api.get("/search/resources", { params: { q } });
      setHits(res.data.results);
      setActiveQuery(q);
    } catch (err: any) {
      setError(
        err.response?.status === 429
          ? "You're searching too fast. Wait a moment and try again."
          : "Search failed. Check that the server is running and try again."
      );
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    // Load the full list and the user's saved ids together, then run any
    // search that arrived via the URL (from the dashboard's search box).
    Promise.all([api.get("/resources", { params: { limit: 100 } }), api.get("/saved")])
      .then(([resources, saved]) => {
        setBrowse(resources.data.resources);
        setSavedIds(new Set(saved.data.resources.map((r: ResourceSummary) => r._id)));
      })
      .catch(() => setError("Couldn't load the library. Check that the server is running and try again."))
      .finally(() => setLoading(false));

    const initial = searchParams.get("q")?.trim();
    if (initial) runSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return clearSearch();
    setSearchParams({ q });
    runSearch(q);
  };

  const clearSearch = () => {
    setQuery("");
    setHits(null);
    setActiveQuery(null);
    setSearchParams({});
  };

  const toggleSave = async (id: string) => {
    const wasSaved = savedIds.has(id);
    const flip = (on: boolean) =>
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });

    flip(!wasSaved); // optimistic
    try {
      if (wasSaved) await api.delete(`/saved/${id}`);
      else await api.post(`/saved/${id}`);
    } catch {
      flip(wasSaved); // roll back
      setError("Couldn't update your saved list. Try again.");
    }
  };

  const inCategory = (c: string) => category === "All" || c === category;
  const visibleBrowse = browse.filter((r) => inCategory(r.category));
  const visibleHits = hits?.filter((h) => inCategory(h.category));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Library</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Search finds documents by meaning, not exact words. Try "time off from school" to find the leave of
          absence policy.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex gap-2.5" role="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the library"
            placeholder="Search for a service, form, or policy…"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-xl bg-accent px-6 text-sm font-bold text-bg disabled:opacity-60"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                category === c
                  ? "border-accent bg-accent text-bg"
                  : "border-border text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {hits !== null && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              {visibleHits!.length} result{visibleHits!.length === 1 ? "" : "s"} for "{activeQuery}"
            </p>
            <button onClick={clearSearch} className="text-sm font-semibold text-accent hover:underline">
              Clear search
            </button>
          </div>
        )}

        <div className="mt-5">
          {loading && <p className="text-sm text-ink-faint">Loading the library…</p>}

          {/* ---- Search results ---- */}
          {hits !== null && visibleHits!.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-ink-soft">
                No close matches{category !== "All" ? ` in ${category}` : ""}. Try different wording, or ask
                the assistant, which can explain things in plain language.
              </p>
              <Link
                to={`/chat?q=${encodeURIComponent(activeQuery ?? "")}`}
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-bold text-bg"
              >
                Ask the assistant
              </Link>
            </div>
          )}

          {hits !== null && visibleHits!.length > 0 && (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleHits!.map((h) => (
                <ResourceCard
                  key={h.resourceId}
                  title={h.title}
                  category={h.category}
                  text={h.snippet}
                  matchScore={h.score}
                  saved={savedIds.has(h.resourceId)}
                  onToggleSave={() => toggleSave(h.resourceId)}
                  onOpen={() => setOpenId(h.resourceId)}
                />
              ))}
            </div>
          )}

          {/* ---- Browse everything ---- */}
          {hits === null && !loading && visibleBrowse.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-faint">
              {category === "All"
                ? "No documents have been added yet. An admin can add them from the Upload page."
                : `No documents in ${category} yet.`}
            </p>
          )}

          {hits === null && visibleBrowse.length > 0 && (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBrowse.map((r) => (
                <ResourceCard
                  key={r._id}
                  title={r.title}
                  category={r.category}
                  text={r.description}
                  saved={savedIds.has(r._id)}
                  onToggleSave={() => toggleSave(r._id)}
                  onOpen={() => setOpenId(r._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {openId && (
        <ResourceModal
          resourceId={openId}
          saved={savedIds.has(openId)}
          onToggleSave={() => toggleSave(openId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}