import fs from "fs";
import path from "path";
import mammoth from "mammoth";

/**
 * ================================================================
 * UPDATE NOTE: this file originally used the `pdf-parse` package.
 * While testing, `pdf-parse` failed to read several validly-formed
 * PDFs (confirmed valid with an independent tool, poppler's
 * `pdftotext`) - its bundled PDF engine is old and unmaintained and
 * choked on PDFs from a common generator library (pdfkit). It was
 * swapped for `pdfjs-dist` - Mozilla's own, actively-maintained PDF.js
 * library - which correctly extracted text from every test file,
 * including all the ones that broke `pdf-parse`. If you already ran
 * `npm install pdf-parse` before receiving this update: run
 * `npm uninstall pdf-parse @types/pdf-parse` and `npm install pdfjs-dist`.
 * ================================================================
 *
 * pdfjs-dist is normally a browser library (it renders PDFs visually).
 * We only need its text-extraction capability, and only in Node - that's
 * exactly what the "legacy" build under pdfjs-dist/legacy/build/pdf.mjs
 * is for. It's ESM-only (no CommonJS build), which is why we use a
 * dynamic `import()` even though the rest of this project uses
 * `require`-style CommonJS via `import ... from`.
 */

let pdfjsLibPromise: ReturnType<typeof loadPdfjs> | null = null;

async function loadPdfjs() {
  // @ts-ignore - pdfjs-dist's legacy build ships only .mjs with its own
  // type declarations that don't perfectly match a dynamic import() call
  // from CommonJS; this is the officially documented way to use it from
  // Node regardless.
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

// Points pdf.js at its own bundled fallback font metrics, used when a PDF
// references a standard font (Helvetica, Times, etc.) without embedding
// it. Without this, extraction still works but prints a harmless warning
// to the console for every such font.
const getStandardFontDataUrl = (): string => {
  const fontsDir = path.join(
    path.dirname(require.resolve("pdfjs-dist/package.json")),
    "standard_fonts"
  );
  return `file://${fontsDir}/`;
};

const extractFromPdf = async (filePath: string): Promise<string> => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = loadPdfjs();
  }
  const pdfjsLib = await pdfjsLibPromise;

  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false, // we're in Node, not a browser - no web worker to fetch from
    standardFontDataUrl: getStandardFontDataUrl(),
  });

  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Each "item" is roughly one run of text on the page. TextMarkedContent
    // items (used for accessibility tagging) don't have a `.str` - we skip
    // those and only keep actual text items.
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    fullText += pageText + "\n";
  }

  return fullText;
};

/**
 * This is the piece that turns "a file sitting on disk" into "plain text
 * we can actually chunk and embed." Each file type needs a completely
 * different approach, because PDF/DOCX are binary formats with their own
 * internal structure - there's no way to just "read the text" without a
 * parser that understands that structure.
 *
 * We dispatch by file extension since that's what we already trust from
 * upload.config.ts's whitelist (pdf, txt, docx only).
 */
export const extractTextFromFile = async (filePath: string): Promise<string> => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    return extractFromPdf(filePath);
  }

  if (ext === ".docx") {
    // mammoth reads the actual paragraph structure out of a .docx (which is
    // really a zip file full of XML) and gives us back plain text.
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  throw new Error(`Unsupported file type for text extraction: ${ext}`);
};