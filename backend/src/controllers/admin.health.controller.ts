import { Request, Response } from "express";
import mongoose from "mongoose";
import Resource from "../models/Resource.model";
import Chunk from "../models/Chunk.model";
import { asyncHandler } from "../utils/asyncHandler";
import { VECTOR_INDEX_NAME } from "../services/vectorSearch.service";
import { EMBEDDING_DIMENSIONS, getEmbeddingStatus } from "../services/embedding.service";
import { GENERATION_MODEL } from "../services/llm.service";
import { cleanupOrphans, countOrphans } from "../services/resourceCleanup.service";

/** Rejects if `promise` takes longer than `ms`, so one hung dependency can't hang the whole panel. */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const checkDatabase = async () => {
  const readyState = mongoose.connection.readyState;
  const base = { name: mongoose.connection.name || null, latencyMs: null as number | null };

  if (readyState !== 1) {
    return { ...base, status: STATES[readyState] ?? "unknown" };
  }
  try {
    const started = Date.now();
    await withTimeout(mongoose.connection.db!.admin().ping(), 3000);
    return { ...base, status: "connected", latencyMs: Date.now() - started };
  } catch (err) {
    return { ...base, status: "error", detail: message(err) };
  }
};

/**
 * Asks Atlas whether the vector index exists, is finished building, and was
 * built for the right number of dimensions. This is the check that would
 * have flagged a wrong index (384 vs 1536) immediately, instead of leaving
 * search silently returning nothing.
 */
const checkVectorIndex = async () => {
  const base = { name: VECTOR_INDEX_NAME, expectedDimensions: EMBEDDING_DIMENSIONS };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indexes: any[] = await withTimeout(
      (Chunk.collection as any).listSearchIndexes(VECTOR_INDEX_NAME).toArray(),
      5000
    );
    const index = indexes[0];
    if (!index) return { ...base, status: "missing", queryable: false, numDimensions: null };

    const definition = index.latestDefinition ?? index.definition;
    const vectorField = definition?.fields?.find((f: { type: string }) => f.type === "vector");
    const failed = String(index.status ?? "").toUpperCase() === "FAILED";

    return {
      ...base,
      status: index.queryable ? "ready" : failed ? "failed" : "building",
      queryable: !!index.queryable,
      numDimensions: (vectorField?.numDimensions as number | undefined) ?? null,
    };
  } catch (err) {
    return {
      ...base,
      status: "unknown",
      queryable: false,
      numDimensions: null,
      detail: `Couldn't check the index (this needs MongoDB Atlas): ${message(err)}`,
    };
  }
};

/**
 * GET /api/admin/health
 * Everything an admin would otherwise discover only when users complain.
 * Intentionally pull-only (a Refresh button, no polling): the whole API is
 * rate limited per IP, and a panel that re-checks every few seconds would
 * eat that allowance.
 */
export const getSystemHealth = asyncHandler(async (_req: Request, res: Response) => {
  const [database, vectorIndex, orphans, published, drafts, indexedIds] = await Promise.all([
    checkDatabase(),
    checkVectorIndex(),
    countOrphans(),
    Resource.countDocuments({ isPublished: true }),
    Resource.countDocuments({ isPublished: false }),
    Chunk.distinct("resource"),
  ]);

  const publishedWithoutChunks = await Resource.countDocuments({
    isPublished: true,
    _id: { $nin: indexedIds },
  });

  const embeddings = getEmbeddingStatus();
  const llm = {
    provider: "Google Gemini",
    model: GENERATION_MODEL,
    configured: Boolean(process.env.GEMINI_API_KEY),
  };
  const memory = process.memoryUsage();

  // ---- turn the raw facts into plain-language problems ----
  const issues: string[] = [];
  if (vectorIndex.status === "missing") {
    issues.push(`The vector index "${vectorIndex.name}" doesn't exist, so search and chat can't find anything.`);
  } else if (vectorIndex.status === "failed") {
    issues.push(`The vector index "${vectorIndex.name}" failed to build - recreate it in Atlas.`);
  } else if (vectorIndex.status === "building") {
    issues.push(`The vector index "${vectorIndex.name}" is still building; search won't work until it's ready.`);
  }
  if (vectorIndex.numDimensions !== null && vectorIndex.numDimensions !== EMBEDDING_DIMENSIONS) {
    issues.push(
      `The vector index expects ${vectorIndex.numDimensions}-dimension vectors but the embedding model produces ${EMBEDDING_DIMENSIONS}.`
    );
  }
  if (!llm.configured) issues.push("GEMINI_API_KEY isn't set, so chat can't generate answers.");
  if (embeddings.status === "failed") {
    issues.push("The embedding model failed to load (it needs internet access on first use).");
  }
  if (publishedWithoutChunks > 0) {
    issues.push(
      `${publishedWithoutChunks} published document${publishedWithoutChunks === 1 ? " has" : "s have"} no search data - re-index ${publishedWithoutChunks === 1 ? "it" : "them"} on the Documents page.`
    );
  }
  if (orphans.orphanChunks + orphans.orphanSaves > 0) {
    issues.push(
      `${orphans.orphanChunks + orphans.orphanSaves} leftover record${orphans.orphanChunks + orphans.orphanSaves === 1 ? "" : "s"} from deleted documents - use "Clean up".`
    );
  }

  const status = database.status !== "connected" ? "down" : issues.length > 0 ? "degraded" : "healthy";

  res.status(200).json({
    success: true,
    status,
    issues,
    checkedAt: new Date().toISOString(),
    api: {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      memoryMB: {
        rss: Math.round(memory.rss / 1048576),
        heapUsed: Math.round(memory.heapUsed / 1048576),
      },
    },
    database,
    vectorIndex,
    embeddings,
    llm,
    content: {
      publishedResources: published,
      draftResources: drafts,
      publishedWithoutChunks,
      orphanChunks: orphans.orphanChunks,
      orphanSaves: orphans.orphanSaves,
    },
  });
});

/**
 * POST /api/admin/maintenance/cleanup-orphans
 * Removes search chunks and bookmarks left behind by documents that were
 * deleted before deletes cascaded (before Week 6).
 */
export const runOrphanCleanup = asyncHandler(async (_req: Request, res: Response) => {
  const removed = await cleanupOrphans();
  res.status(200).json({ success: true, removed });
});
