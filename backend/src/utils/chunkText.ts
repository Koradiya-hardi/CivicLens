
export interface ChunkOptions {
  chunkSize?: number; // target max characters per chunk
  overlap?: number; // characters of overlap carried into the next chunk
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

/**
 * Splits text into paragraphs first (on blank lines), since paragraph
 * boundaries are usually meaningful semantic breaks - much better than
 * chopping every N characters regardless of what's there.
 */
const splitIntoParagraphs = (text: string): string[] => {
  return text
    .split(/\n\s*\n/) // blank line = paragraph break
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

/**
 * A single paragraph can still be longer than our chunk size (a dense legal
 * paragraph, for instance). In that case we fall back to splitting on
 * sentence boundaries within it, so we never produce one giant unbreakable
 * chunk regardless of how the source document is formatted.
 */
const splitLongParagraph = (paragraph: string, chunkSize: number): string[] => {
  if (paragraph.length <= chunkSize) return [paragraph];

  // Split on ". " as a simple sentence boundary heuristic - not perfect
  // (misses "Mr. Smith" etc.) but good enough for chunking purposes; we're
  // not doing linguistic analysis, just trying to avoid cutting mid-sentence
  // most of the time.
  const sentences = paragraph.split(/(?<=[.?!])\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > chunkSize && current) {
      pieces.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) pieces.push(current.trim());

  return pieces;
};

export const chunkText = (text: string, options: ChunkOptions = {}): string[] => {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  // Normalize whitespace so weird PDF extraction artifacts (double spaces,
  // stray tabs) don't throw off our length-based decisions below.
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (!normalized) return [];

  // Break into paragraphs, and pre-split any paragraph too long to fit in
  // one chunk on its own - gives us a flat list of "units" no unit of which
  // exceeds chunkSize by itself.
  const units = splitIntoParagraphs(normalized).flatMap((p) =>
    splitLongParagraph(p, chunkSize)
  );

  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;

    if (candidate.length > chunkSize && current) {
      // Current chunk is full - finalize it, then start the next chunk by
      // carrying over the tail of the previous one (the overlap).
      chunks.push(current);
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${unit}`.trim();
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
};



/**
 * WHY chunking exists at all:
 * if you embed an ENTIRE 20-page handbook as one single vector, a question about "leave of
 * absence" (one paragraph, page 12) gets diluted into a vague average of
 * everything in the document - the search becomes useless. Instead, we
 * split each Resource's content into small, focused chunks, embed each
 * chunk SEPARATELY, and search across chunks - so a question can match the
 * one specific paragraph that actually answers it.
 *
 * WHY overlap between chunks:
 * If we cut chunks at hard boundaries with no overlap, a sentence that
 * happens to straddle the cut point gets split in half, and neither
 * resulting chunk contains the complete idea. A small overlap (the tail of
 * chunk N is repeated at the start of chunk N+1) means that edge case
 * almost always gets fully captured in at least one of the two chunks.
 */