import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { HealthStatus, SystemHealth } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { formatUptime } from "@/lib/format";
import { timeAgo } from "@/lib/dates";
import { StatusPill } from "@/components/admin/StatusPill";

const OVERALL: Record<HealthStatus, { label: string; tone: "good" | "warn" | "bad"; text: string }> = {
  healthy: { label: "All systems working", tone: "good", text: "Search and chat should work normally." },
  degraded: { label: "Needs attention", tone: "warn", text: "The app is running, but something below needs fixing." },
  down: { label: "Database unreachable", tone: "bad", text: "Nothing that needs data will work until this is fixed." },
};

/**
 * Health is fetched on demand (page load + Refresh), never on a timer: each
 * check pings the database and Atlas, and the API is rate-limited.
 */
export default function AdminHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/health");
      setHealth(res.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't run the health check."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cleanUp = async () => {
    setCleaning(true);
    setNotice(null);
    try {
      const res = await api.post("/admin/maintenance/cleanup-orphans");
      const r = res.data.removed;
      setNotice(`Removed ${r.chunksRemoved} leftover search passage(s) and ${r.savesRemoved} leftover bookmark(s).`);
      await load();
    } catch (e) {
      setError(errorMessage(e, "Clean-up failed."));
    } finally {
      setCleaning(false);
    }
  };

  if (!health) {
    return error ? (
      <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    ) : (
      <p className="text-sm text-ink-soft">Running checks…</p>
    );
  }

  const overall = OVERALL[health.status];
  const c = health.content;
  const leftovers = c.orphanChunks + c.orphanSaves;
  const idx = health.vectorIndex;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <StatusPill tone={overall.tone}>{overall.label}</StatusPill>
            <span className="text-xs text-ink-faint">checked {timeAgo(health.checkedAt)}</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{overall.text}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {health.issues.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-sm font-bold text-amber-200">What to fix</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {health.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title="Database"
          pill={<StatusPill tone={health.database.status === "connected" ? "good" : "bad"}>{health.database.status}</StatusPill>}
        >
          <Row k="Name" v={health.database.name ?? "-"} />
          <Row k="Response time" v={health.database.latencyMs === null ? "-" : `${health.database.latencyMs} ms`} />
          {health.database.detail && <Row k="Detail" v={health.database.detail} />}
        </Panel>

        <Panel
          title="Search index"
          pill={
            <StatusPill tone={idx.status === "ready" ? "good" : idx.status === "building" || idx.status === "unknown" ? "warn" : "bad"}>
              {idx.status}
            </StatusPill>
          }
        >
          <Row k="Index name" v={idx.name} />
          <Row k="Dimensions" v={`${idx.numDimensions ?? "-"} (model makes ${idx.expectedDimensions})`} />
          {idx.detail && <Row k="Detail" v={idx.detail} />}
        </Panel>

        <Panel
          title="Embedding model"
          pill={
            <StatusPill tone={health.embeddings.status === "ready" ? "good" : health.embeddings.status === "failed" ? "bad" : "neutral"}>
              {health.embeddings.status === "not_loaded" ? "not loaded yet" : health.embeddings.status}
            </StatusPill>
          }
        >
          <Row k="Model" v={health.embeddings.model} />
          <Row k="Dimensions" v={String(health.embeddings.dimensions)} />
          <p className="pt-1 text-xs text-ink-faint">It loads the first time someone searches, so "not loaded yet" right after a restart is normal.</p>
        </Panel>

        <Panel title="Answer generation" pill={<StatusPill tone={health.llm.configured ? "good" : "bad"}>{health.llm.configured ? "key set" : "key missing"}</StatusPill>}>
          <Row k="Provider" v={health.llm.provider} />
          <Row k="Model" v={health.llm.model} />
        </Panel>

        <Panel title="API server" pill={<StatusPill tone="good">{health.api.status}</StatusPill>}>
          <Row k="Uptime" v={formatUptime(health.api.uptimeSeconds)} />
          <Row k="Memory" v={`${health.api.memoryMB.rss} MB (heap ${health.api.memoryMB.heapUsed} MB)`} />
          <Row k="Node" v={`${health.api.nodeVersion} · ${health.api.environment}`} />
        </Panel>

        <Panel
          title="Content"
          pill={<StatusPill tone={c.publishedWithoutChunks + leftovers > 0 ? "warn" : "good"}>{c.publishedWithoutChunks + leftovers > 0 ? "check" : "ok"}</StatusPill>}
        >
          <Row k="Published / drafts" v={`${c.publishedResources} / ${c.draftResources}`} />
          <Row k="Published but not indexed" v={String(c.publishedWithoutChunks)} />
          <Row k="Leftovers from deleted documents" v={String(leftovers)} />
          {leftovers > 0 && (
            <button
              onClick={cleanUp}
              disabled={cleaning}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {cleaning ? "Cleaning…" : "Clean up"}
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, pill, children }: { title: string; pill: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {pill}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-ink-soft">{k}</span>
      <span className="break-all text-right text-ink">{v}</span>
    </div>
  );
}
