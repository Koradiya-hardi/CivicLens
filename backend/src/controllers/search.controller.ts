import { Request, Response } from "express";
import { semanticSearch } from "../services/vectorSearch.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { logQuery, describeResults } from "../services/queryLog.service";
import { buildSnippet } from "../utils/snippet";

/**
 * GET /api/search?q=...
 * Public - this is "Smart Search" from the original project spec: search
 * by MEANING, not just keywords. Deliberately kept as its own endpoint,
 * separate from the chatbot (Day 4) - lets you verify semantic search is
 * actually working (e.g. "time off school" correctly finding a chunk
 * about "leave of absence" despite sharing no words) before adding the
 * extra complexity of an LLM on top of it.
 */
export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;

  if (!q || q.trim().length === 0) {
    throw new AppError("Query parameter 'q' is required", 400);
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
  const results = await semanticSearch(q, limit);

  res.status(200).json({
    success: true,
    query: q,
    count: results.length,
    results,
  });
});

/**
 * Results scoring below this are treated as "not really a match" and
 * dropped. Like the chat confidence threshold, this is a STARTING POINT:
 * tune it by searching real queries and watching what scores relevant
 * vs. irrelevant results actually get. Override without a code change via
 * the MIN_SEARCH_SCORE env var.
 */
const MIN_SEARCH_SCORE = Number(process.env.MIN_SEARCH_SCORE) || 0.55;

/**
 * GET /api/search/resources?q=...&limit=10
 * Public. The "Smart search bar" endpoint.
 *
 * semanticSearch() works at the CHUNK level, so one long document can
 * return five chunks. A search results page wants ONE row per document,
 * so we over-fetch chunks (3x), keep only the best-scoring chunk per
 * resource (results arrive best-first, so the first one seen wins), and
 * return that chunk as the "matched passage".
 */
export const searchResources = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;

  if (!q || q.trim().length === 0) {
    throw new AppError("Query parameter 'q' is required", 400);
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
  const chunks = await semanticSearch(q, Math.min(limit * 3, 30));

  const best = new Map<
    string,
    {
      resourceId: string;
      title: string;
      category: string;
      description: string;
      snippet: string;
      score: number;
    }
  >();

  for (const chunk of chunks) {
    if (chunk.score < MIN_SEARCH_SCORE || best.has(chunk.resourceId)) continue;

    best.set(chunk.resourceId, {
      resourceId: chunk.resourceId,
      title: chunk.resourceTitle,
      category: chunk.category,
      description: chunk.resourceDescription,
      snippet: buildSnippet(chunk.text, 200),
      score: chunk.score,
    });
  }

  const results = Array.from(best.values()).slice(0, limit);

  // Admin analytics. When nothing cleared the relevance floor we still record
  // the best (too-weak) score, so an admin can see "close, but not close enough".
  logQuery({
    source: "search",
    query: q,
    outcome: results.length ? "results" : "no_results",
    ...(results.length
      ? describeResults(results)
      : {
          resultCount: 0,
          topScore: chunks.length ? Math.round(chunks[0].score * 1000) / 1000 : undefined,
        }),
  });

  res.status(200).json({ success: true, query: q, count: results.length, results });
});
