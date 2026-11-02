export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
      <span>
        {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:text-ink disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:text-ink disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
