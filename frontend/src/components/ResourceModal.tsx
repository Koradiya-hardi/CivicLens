import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { fileHref } from "@/lib/files";

interface FullResource {
  _id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  sourceUrl?: string;
  fileUrl?: string;
  fileName?: string;
  updatedAt: string;
}

interface Props {
  resourceId: string;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

/** Full-document viewer, opened from a resource card. */
export function ResourceModal({ resourceId, saved, onToggleSave, onClose }: Props) {
  const [resource, setResource] = useState<FullResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api
      .get(`/resources/${resourceId}`)
      .then((res) => setResource(res.data.resource))
      .catch(() => setError("Couldn't load this document. It may have been removed."));
  }, [resourceId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={resource?.title ?? "Document"}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            {resource && (
              <span className="rounded-full bg-accent-2/10 px-2.5 py-0.5 text-[11px] font-bold text-accent-2">
                {resource.category}
              </span>
            )}
            <h2 className="mt-2 text-lg font-bold text-ink">{resource?.title ?? "Loading…"}</h2>
            {resource && <p className="mt-1 text-sm text-ink-soft">{resource.description}</p>}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!resource && !error && <p className="text-sm text-ink-faint">Loading document…</p>}
          {resource && (
            <p className="max-w-[75ch] whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {resource.content}
            </p>
          )}
        </div>

        {resource && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <Link
              to={`/chat?q=${encodeURIComponent(`What should I know about ${resource.title}?`)}`}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-bg"
            >
              Ask about this
            </Link>
            <button
              onClick={onToggleSave}
              aria-pressed={saved}
              className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink"
            >
              {saved ? "Remove from saved" : "Save"}
            </button>
            {resource.fileUrl && (
              <a
                href={fileHref(resource.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink"
              >
                Open original file
              </a>
            )}
            {resource.sourceUrl && (
              <a
                href={resource.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink"
              >
                Official source
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}