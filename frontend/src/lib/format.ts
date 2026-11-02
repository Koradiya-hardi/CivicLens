export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/** 0.873 -> "87%". null -> "-". */
export const formatPercent = (ratio: number | null | undefined): string =>
  ratio === null || ratio === undefined ? "-" : `${Math.round(ratio * 100)}%`;

export const formatNumber = (n: number): string => n.toLocaleString("en-US");

/** "2026-10-05" -> "Oct 5" (UTC, because the backend buckets by UTC day). */
export const formatDay = (isoDate: string): string =>
  new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
