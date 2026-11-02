import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AnalyticsData } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatPercent } from "@/lib/format";
import { timeAgo } from "@/lib/dates";
import { StatCard } from "@/components/admin/StatCard";
import { ActivityChart } from "@/components/admin/ActivityChart";

const RANGES = [7, 30, 90] as const;

export default function AdminOverviewPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .get("/admin/analytics", { params: { days } })
      .then((res) => !cancelled && setData(res.data))
      .catch((e) => !cancelled && setError(errorMessage(e, "Couldn't load analytics.")));
    return () => {
      cancelled = true; // ignore a slow response from a range the admin already switched away from
    };
  }, [days]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-ink-soft">Loading analytics…</p>;

  const { usage, totals } = data;
  const maxCategory = Math.max(1, ...data.topCategories.map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Showing the last {data.windowDays} days. Questions are only counted from the day this feature was switched on.
        </p>
        <div role="group" aria-label="Time range" className="flex gap-0.5 rounded-xl bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                days === r ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Questions asked" value={formatNumber(usage.questions)} hint={`${usage.noAnswer} unanswered`} />
        <StatCard label="Answer rate" value={formatPercent(usage.answerRate)} hint="answered from the library" />
        <StatCard label="Library searches" value={formatNumber(usage.searches)} />
        <StatCard label="Active people" value={formatNumber(usage.activeUsers)} hint={`${usage.newUsers} new`} />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Activity per day</h2>
        <ActivityChart series={data.series} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">Most-asked questions</h2>
          <p className="mb-3 text-xs text-ink-faint">Similar wording is grouped together.</p>
          {data.topQueries.length === 0 ? (
            <Empty>Nothing asked yet.</Empty>
          ) : (
            <ol className="divide-y divide-border">
              {data.topQueries.map((q) => (
                <li key={q.query} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink" title={q.query}>
                      {q.query}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {formatPercent(q.answeredRate)} answered · last {timeAgo(q.lastAsked)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink">{q.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold text-ink">Most-searched topics</h2>
          <p className="mb-3 text-xs text-ink-faint">The category of the document that best matched each question.</p>
          {data.topCategories.length === 0 ? (
            <Empty>No topics yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {data.topCategories.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink">{c.category}</span>
                    <span className="text-ink-soft">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-accent to-accent-2"
                      style={{ width: `${(c.count / maxCategory) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-amber-500/20 bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Content gaps - questions the library couldn't answer</h2>
        <p className="mb-3 text-xs text-ink-faint">
          These are the best candidates for new documents. A low "best match" means nothing close exists.
        </p>
        {data.unanswered.length === 0 ? (
          <Empty>Every question so far was answered. 🎉</Empty>
        ) : (
          <ol className="divide-y divide-border">
            {data.unanswered.map((q) => (
              <li key={q.query} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink" title={q.query}>
                    {q.query}
                  </div>
                  <div className="text-xs text-ink-faint">
                    best match {q.bestScore === null ? "-" : q.bestScore.toFixed(2)} · last {timeAgo(q.lastAsked)}
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-300">{q.count}×</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">Everything, all time</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="People" value={formatNumber(totals.users)} hint={`${totals.admins} admin${totals.admins === 1 ? "" : "s"}`} />
          <StatCard
            label="Documents"
            value={formatNumber(totals.publishedResources)}
            hint={`${totals.draftResources} draft${totals.draftResources === 1 ? "" : "s"}`}
          />
          <StatCard label="Search passages" value={formatNumber(totals.chunks)} hint="indexed chunks" />
          <StatCard label="Conversations" value={formatNumber(totals.conversations)} hint={`${formatNumber(totals.messages)} messages`} />
        </div>
      </section>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-ink-faint">{children}</p>;
}
