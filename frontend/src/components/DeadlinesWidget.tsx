import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { DeadlineItem } from "@/lib/types";
import { daysUntil, describeDue, formatDueDate, todayInputValue } from "@/lib/dates";

/** Incomplete first, soonest first; completed ones sink to the bottom. */
const sortItems = (items: DeadlineItem[]) =>
  [...items].sort((a, b) =>
    a.completed !== b.completed
      ? Number(a.completed) - Number(b.completed)
      : a.dueDate.localeCompare(b.dueDate)
  );

const dueTone = (item: DeadlineItem): string => {
  if (item.completed) return "text-ink-faint";
  const n = daysUntil(item.dueDate);
  if (n < 0) return "text-red-300";
  if (n <= 3) return "text-amber-300";
  return "text-ink-soft";
};

export function DeadlinesWidget({ initial }: { initial: DeadlineItem[] }) {
  const [items, setItems] = useState<DeadlineItem[]>(sortItems(initial));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await api.post("/deadlines", { title, dueDate, note });
      setItems((prev) => sortItems([...prev, res.data.deadline]));
      setTitle("");
      setDueDate("");
      setNote("");
      setAdding(false);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Couldn't save the deadline. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await api.patch(`/deadlines/${id}/toggle`);
      setItems((prev) => sortItems(prev.map((d) => (d._id === id ? res.data.deadline : d))));
    } catch {
      setError("Couldn't update that deadline. Try again.");
    }
  };

  const handleRemove = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((d) => d._id !== id)); // optimistic
    try {
      await api.delete(`/deadlines/${id}`);
    } catch {
      setItems(previous); // roll back
      setError("Couldn't remove that deadline. Try again.");
    }
  };

  return (
    <section aria-labelledby="deadlines-heading" className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="deadlines-heading" className="text-base font-bold text-ink">
          Deadlines
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink hover:bg-border"
          >
            Add deadline
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {adding && (
        <form onSubmit={handleAdd} className="mb-5 space-y-3 rounded-lg border border-border bg-bg p-4">
          <div>
            <label htmlFor="dl-title" className="block text-xs font-medium text-ink-soft">
              What is it?
            </label>
            <input
              id="dl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Health insurance enrollment closes"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="dl-date" className="block text-xs font-medium text-ink-soft">
              Due date
            </label>
            <input
              id="dl-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              min={todayInputValue()}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink [color-scheme:dark] focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="dl-note" className="block text-xs font-medium text-ink-soft">
              Note (optional)
            </label>
            <input
              id="dl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Bring proof of address"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-bg disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save deadline"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-ink-faint">
          No deadlines yet. Add one and it will stay on your dashboard until you check it off.
        </p>
      )}

      <ul className="space-y-1">
        {items.map((d) => (
          <li key={d._id} className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
            <button
              onClick={() => handleToggle(d._id)}
              aria-label={d.completed ? `Mark "${d.title}" as not done` : `Mark "${d.title}" as done`}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                d.completed ? "border-accent-2 bg-accent-2 text-bg" : "border-ink-faint hover:border-accent-2"
              }`}
            >
              {d.completed && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${d.completed ? "text-ink-faint line-through" : "text-ink"}`}>
                {d.title}
              </p>
              <p className={`text-xs ${dueTone(d)}`}>
                {formatDueDate(d.dueDate)}
                {!d.completed && <span> ({describeDue(d.dueDate)})</span>}
              </p>
              {d.note && <p className="mt-0.5 text-xs text-ink-faint">{d.note}</p>}
            </div>

            <button
              onClick={() => handleRemove(d._id)}
              aria-label={`Remove "${d.title}"`}
              className="rounded px-1.5 py-0.5 text-xs text-ink-faint opacity-0 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}