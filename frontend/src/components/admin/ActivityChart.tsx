import { formatDay } from "@/lib/format";

interface Point {
  date: string;
  questions: number;
  searches: number;
}

/**
 * Daily questions + searches as paired bars. Hand-drawn with divs so the app
 * needs no charting library. Every bar has a text tooltip (title) and the
 * whole chart has a text summary for screen readers.
 */
export function ActivityChart({ series }: { series: Point[] }) {
  const max = Math.max(1, ...series.flatMap((p) => [p.questions, p.searches]));
  const total = series.reduce((n, p) => n + p.questions + p.searches, 0);
  // Label roughly 6 days so the axis never gets crowded.
  const step = Math.max(1, Math.ceil(series.length / 6));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Questions to the assistant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent-2" /> Library searches
        </span>
      </div>

      {total === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-ink-faint">
          No activity in this period yet.
        </div>
      ) : (
        <div
          role="img"
          aria-label={`Daily activity: ${series.reduce((n, p) => n + p.questions, 0)} questions and ${series.reduce((n, p) => n + p.searches, 0)} searches over ${series.length} days`}
        >
          <div className="flex h-40 items-end gap-[3px]">
            {series.map((p) => (
              <div
                key={p.date}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
                title={`${formatDay(p.date)}: ${p.questions} question${p.questions === 1 ? "" : "s"}, ${p.searches} search${p.searches === 1 ? "" : "es"}`}
              >
                <div
                  className="w-1/2 rounded-t-sm bg-accent"
                  style={{ height: `${(p.questions / max) * 100}%`, minHeight: p.questions ? 2 : 0 }}
                />
                <div
                  className="w-1/2 rounded-t-sm bg-accent-2"
                  style={{ height: `${(p.searches / max) * 100}%`, minHeight: p.searches ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px] text-[10px] text-ink-faint" aria-hidden="true">
            {series.map((p, i) => (
              <div key={p.date} className="min-w-0 flex-1 text-center">
                {i % step === 0 ? formatDay(p.date) : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
