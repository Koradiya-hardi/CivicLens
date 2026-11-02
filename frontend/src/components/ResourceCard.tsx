interface Props {
  title: string;
  category: string;
  /** Short text shown under the title: a description, or a matched passage in search results. */
  text: string;
  /** Set only in search results; drives the "Strong match" / "Possible match" label. */
  matchScore?: number;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
}

export function ResourceCard({ title, category, text, matchScore, saved, onToggleSave, onOpen }: Props) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent-2/10 px-2.5 py-0.5 text-[11px] font-bold text-accent-2">
          {category}
        </span>
        {matchScore !== undefined && (
          <span className="text-[11px] font-semibold text-ink-faint">
            {matchScore >= 0.7 ? "Strong match" : "Possible match"}
          </span>
        )}
      </div>

      <h3 className="mb-1.5 text-[15px] font-bold leading-snug text-ink">{title}</h3>
      <p className="mb-4 line-clamp-3 flex-1 text-[13px] leading-relaxed text-ink-soft">{text}</p>

      <div className="flex items-center justify-between">
        <button
          onClick={onOpen}
          className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-border"
        >
          Read
        </button>
        <button
          onClick={onToggleSave}
          aria-pressed={saved}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
            saved ? "text-accent" : "text-ink-soft hover:text-ink"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} aria-hidden="true">
            <path
              d="M6 4h12v17l-6-4-6 4V4z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}