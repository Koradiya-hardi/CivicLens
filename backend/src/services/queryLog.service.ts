import mongoose from "mongoose";
import QueryLog, { QueryOutcome, QuerySource } from "../models/QueryLog.model";

/**
 * Lowercases, strips punctuation and collapses whitespace so that
 * "Can I take a leave of absence?" and "can i take a leave of absence"
 * count as the SAME question in the analytics. Apostrophes are kept
 * ("don't" stays "don't"). Unicode-aware so non-English text survives.
 */
export const normalizeQuery = (query: string): string =>
  query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

/** Pulls the three facts the analytics care about out of a search result list. */
export const describeResults = (results: { score: number; category: string }[]) => ({
  resultCount: results.length,
  topScore: results.length ? Math.round(results[0].score * 1000) / 1000 : undefined,
  topCategory: results.length ? results[0].category : undefined,
});

interface LogEntry {
  source: QuerySource;
  query: string;
  outcome: QueryOutcome;
  user?: mongoose.Types.ObjectId;
  resultCount: number;
  topScore?: number;
  /** Only meaningful when the query was actually answered / matched. */
  topCategory?: string;
}

/**
 * Fire-and-forget: callers do NOT await this. Analytics must never slow
 * down, or break, a real user's request - so every failure is swallowed.
 * Set QUERY_LOGGING=off in .env to turn collection off entirely.
 */
export const logQuery = (entry: LogEntry): void => {
  if (process.env.QUERY_LOGGING === "off") return;

  try {
    const normalized = normalizeQuery(entry.query);
    if (!normalized) return; // "???" - nothing to learn from it

    QueryLog.create({
      ...entry,
      query: entry.query.trim().slice(0, 300),
      normalized,
    }).catch(() => {
      /* analytics failure is never the user's problem */
    });
  } catch {
    /* same: never let logging throw into a request */
  }
};
