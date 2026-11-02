/**
 * Deadlines are calendar DATES. The backend stores "2026-09-20" as midnight
 * UTC, so we must read and format them in UTC too. Formatting with the
 * browser's local timezone would show "Sep 19" for anyone in the US.
 */
export const formatDueDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** Whole days from today (local calendar day) until the due date. Negative = overdue. */
export const daysUntil = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const now = new Date();
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
};

export const describeDue = (iso: string): string => {
  const n = daysUntil(iso);
  if (n < 0) return `Overdue by ${-n} day${n === -1 ? "" : "s"}`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
};

/** "YYYY-MM-DD" for today, for the date input's min attribute. */
export const todayInputValue = (): string => new Date().toLocaleDateString("en-CA");

/** "just now", "5 min ago", "3 hr ago", "2 days ago", else a date. */
export const timeAgo = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};