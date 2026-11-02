import type { Request } from "express";

/**
 * Escapes characters that have special meaning in a regular expression.
 * Admin search boxes build a RegExp from what the admin typed; without this,
 * typing "(" or ".*" would either crash the query or run an expensive
 * pattern (a regex-injection / ReDoS risk).
 */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Safe ?page= / ?limit= parsing with sane defaults and a hard cap. */
export const parsePaging = (query: Request["query"], defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(parseInt(String(query.page)) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit)) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};
