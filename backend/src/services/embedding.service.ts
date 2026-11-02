

import { LruCache } from "../utils/lruCache";

// 500 recent questions, each remembered for an hour.
const embeddingCache = new LruCache<number[]>(500, 60 * 60 * 1000);

export const EMBEDDING_MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
//  "numDimensions" in the Atlas Vector Search index. The admin
// health panel compares the two to catch a 384-vs-1536 mismatch.
export const EMBEDDING_DIMENSIONS = 384;

export type EmbeddingStatus = "not_loaded" | "loading" | "ready" | "failed";
let embeddingStatus: EmbeddingStatus = "not_loaded";

/** Read by the admin health panel. */
export const getEmbeddingStatus = () => ({
  model: EMBEDDING_MODEL_NAME,
  dimensions: EMBEDDING_DIMENSIONS,
  status: embeddingStatus,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

async function loadExtractor() {
  // @ts-ignore - ESM-only package; this is the documented way to use it
  // from a CommonJS/TypeScript project.
  const { pipeline } = await import("@xenova/transformers");


  return pipeline("feature-extraction", EMBEDDING_MODEL_NAME);
}


function getExtractor() {
  if (!extractorPromise) {
    embeddingStatus = "loading";
    extractorPromise = loadExtractor().then(
      (extractor) => {
        embeddingStatus = "ready";
        return extractor;
      },
      (err) => {
        
        embeddingStatus = "failed";
        extractorPromise = null;
        throw err;
      }
    );
  }
  return extractorPromise;
}


export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const embeddings: number[][] = [];

  for (const text of texts) {
    // pooling: "mean" collapses the model's per-word outputs into one
    // single vector representing the whole chunk. normalize: true scales
    // that vector to unit length, which is what cosine-similarity-based
    // vector search (Day 3) expects.
    const output = await extractor(text, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data as Float32Array));
  }

  return embeddings;
};

/**
 * Wraps an "embed many texts" function with a cache for the single-text case.
 *
 * The same question is often asked again (and follow-ups re-embed similar text),
 * and running the model is the slowest local step. Embeddings depend only on the
 * text, so caching them can never serve stale data - unlike caching search results,
 * which change whenever a document is edited. A failed embedding is never cached.
 * Kept as a factory so tests can plug in a fast fake instead of the real model.
 */
export const createCachedEmbedder = (
  embedMany: (texts: string[]) => Promise<number[][]>,
  cache: LruCache<number[]> = new LruCache<number[]>(500, 60 * 60 * 1000)
) => {
  const embedOne = async (text: string): Promise<number[]> => {
    const key = text.trim().toLowerCase().replace(/\s+/g, " ");
    const cached = cache.get(key);
    if (cached) return cached.slice(); // a copy, so a caller can't corrupt the cache

    const [embedding] = await embedMany([text]);
    cache.set(key, embedding);
    return embedding.slice();
  };
  return Object.assign(embedOne, { cache });
};

export const generateEmbedding = createCachedEmbedder(generateEmbeddings, embeddingCache);

export const getEmbeddingCacheStats = () => embeddingCache.stats();
export const clearEmbeddingCache = () => embeddingCache.clear();