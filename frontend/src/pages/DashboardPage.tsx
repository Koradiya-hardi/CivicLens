import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { DashboardData } from "@/lib/types";
import { timeAgo } from "@/lib/dates";
import { ResourceCard } from "@/components/ResourceCard";
import { ResourceModal } from "@/components/ResourceModal";
import { DeadlinesWidget } from "@/components/DeadlinesWidget";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    // One request fills the whole page (see dashboard.controller.ts).
    api
      .get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load your dashboard. Check that the server is running and try again."));
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/library?q=${encodeURIComponent(q)}` : "/library");
  };

  const unsave = async (id: string) => {
    if (!data) return;
    const previous = data;
    setData({
      ...data,
      stats: { ...data.stats, savedCount: Math.max(0, data.stats.savedCount - 1) },
      savedResources: data.savedResources.filter((r) => r._id !== id),
    });
    try {
      await api.delete(`/saved/${id}`);
    } catch {
      setData(previous); // roll back if the server refused
    }
  };

  const firstName = user?.name.split(" ")[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {data
            ? `You have ${data.stats.conversationCount} conversation${data.stats.conversationCount === 1 ? "" : "s"} and ${data.stats.savedCount} saved resource${data.stats.savedCount === 1 ? "" : "s"}.`
            : "Loading your workspace…"}
        </p>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2.5" role="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the library"
            placeholder="Search for a service, form, or policy…"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <button type="submit" className="rounded-xl bg-accent px-6 text-sm font-bold text-bg">
            Search
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-10">
              <section aria-labelledby="saved-heading">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 id="saved-heading" className="text-base font-bold text-ink">
                    Saved resources
                  </h2>
                  <Link to="/library" className="text-sm text-ink-soft hover:text-ink">
                    Browse library
                  </Link>
                </div>

                {data.savedResources.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-faint">
                    Nothing saved yet. Open the{" "}
                    <Link to="/library" className="font-semibold text-accent underline">
                      library
                    </Link>{" "}
                    and press Save on a document to keep it here.
                  </p>
                ) : (
                  <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {data.savedResources.map((r) => (
                      <ResourceCard
                        key={r._id}
                        title={r.title}
                        category={r.category}
                        text={r.description}
                        saved
                        onToggleSave={() => unsave(r._id)}
                        onOpen={() => setOpenId(r._id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="recent-heading">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 id="recent-heading" className="text-base font-bold text-ink">
                    Recent conversations
                  </h2>
                  <Link to="/chat" className="text-sm text-ink-soft hover:text-ink">
                    New conversation
                  </Link>
                </div>

                {data.recentConversations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-faint">
                    No conversations yet.{" "}
                    <Link to="/chat" className="font-semibold text-accent underline">
                      Ask your first question
                    </Link>{" "}
                    and it will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                    {data.recentConversations.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/chat?c=${c.id}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                        >
                          <span className="truncate text-sm font-semibold text-ink">{c.title}</span>
                          <span className="shrink-0 text-xs text-ink-faint">
                            {c.messageCount} messages, {timeAgo(c.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside>
              <DeadlinesWidget initial={data.deadlines} />
            </aside>
          </div>
        )}
      </div>

      {openId && (
        <ResourceModal
          resourceId={openId}
          saved
          onToggleSave={() => {
            unsave(openId);
            setOpenId(null);
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}