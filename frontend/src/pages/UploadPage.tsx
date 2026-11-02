import { useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "@/lib/api";

type Step = "select" | "extracting" | "review" | "processing" | "done";

const CATEGORIES = [
  "Transportation",
  "Housing",
  "Student Services",
  "Financial Aid",
  "Healthcare",
  "Immigration",
  "Taxes",
  "Other",
];

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "select", label: "Select file" },
  { key: "extracting", label: "Extract text" },
  { key: "review", label: "Review" },
  { key: "processing", label: "Create & embed" },
  { key: "done", label: "Done" },
];

export default function UploadPage() {
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Populated once the file is uploaded + extracted (step: review)
  const [fileMeta, setFileMeta] = useState<{
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  const [resultChunkCount, setResultChunkCount] = useState(0);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  /**
   * Step 1 + 2 combined: upload the raw file, then immediately preview
   * its extracted text - exactly the real /api/uploads then
   * /api/ingestion/preview pipeline, just triggered together here for a
   * smoother admin experience (two real API calls, one user action).
   */
  const handleUploadAndExtract = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setStep("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const meta = uploadRes.data.file;
      setFileMeta(meta);

      const previewRes = await api.post("/ingestion/preview", { fileUrl: meta.fileUrl });
      setContent(previewRes.data.fullText);
      setTitle(file.name.replace(/\.[^/.]+$/, "")); // strip extension as a starting title

      setStep("review");
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Upload or extraction failed.");
      setStep("select");
    }
  };

  /**
   * Step 3 + 4: create the Resource with the (possibly admin-edited)
   * content, then immediately trigger ingestion (chunk + embed + store).
   */
  const handleCreateAndIngest = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileMeta) return;

    setError(null);
    setStep("processing");

    try {
      const resourceRes = await api.post("/resources", {
        title,
        category,
        description,
        content,
        ...fileMeta,
      });
      const resourceId = resourceRes.data.resource._id;

      const ingestRes = await api.post(`/ingestion/${resourceId}`);
      setResultChunkCount(ingestRes.data.chunkCount);

      setStep("done");
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to create or ingest the resource.");
      setStep("review");
    }
  };

  const reset = () => {
    setStep("select");
    setFile(null);
    setFileMeta(null);
    setTitle("");
    setCategory(CATEGORIES[0]);
    setDescription("");
    setContent("");
    setError(null);
  };

  const currentIndex = STEP_LABELS.findIndex((s) => s.key === step);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-bold">Add a document</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Upload a PDF, DOCX, or TXT file to add it as a searchable resource.
      </p>

      {/* Progress stepper */}
      <div className="my-7 flex items-center gap-1.5">
        {STEP_LABELS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1.5">
            <div
              className={`h-1.5 flex-1 rounded-full ${
                i <= currentIndex ? "bg-accent" : "bg-surface-2"
              }`}
            />
          </div>
        ))}
      </div>
      <p className="-mt-5 mb-7 text-xs font-semibold text-ink-faint">
        {STEP_LABELS[currentIndex]?.label}
      </p>

      {error && (
        <div className="mb-5 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {(step === "select" || step === "extracting") && (
        <form onSubmit={handleUploadAndExtract} className="space-y-4">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
          />
          <button
            type="submit"
            disabled={!file || step === "extracting"}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-bg disabled:opacity-40"
          >
            {step === "extracting" ? "Uploading & extracting…" : "Upload & extract text"}
          </button>
        </form>
      )}

      {(step === "review" || step === "processing") && (
        <form onSubmit={handleCreateAndIngest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">
              Description (short, public-facing)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">
              Extracted content (review and edit if needed)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              required
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={step === "processing"}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-bg disabled:opacity-40"
          >
            {step === "processing" ? "Creating & generating embeddings…" : "Create & embed"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink">
            ✅ <span className="font-semibold">{title}</span> is live and searchable —{" "}
            {resultChunkCount} chunk{resultChunkCount === 1 ? "" : "s"} embedded.
          </p>
          <button
            onClick={reset}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Add another document
          </button>
        </div>
      )}
      </div>
    </div>
  );
}