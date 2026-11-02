type Tone = "good" | "warn" | "bad" | "neutral";

const TONES: Record<Tone, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-300",
  neutral: "border-border bg-surface-2 text-ink-soft",
};

/** Small coloured label. The text always carries the meaning - colour is only a hint. */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
