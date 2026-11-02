import helmet from "helmet";
import type { NextFunction, Request, RequestHandler, Response } from "express";

const strict = helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } });
const relaxed = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } });

export const securityHeaders: RequestHandler = (req, res, next) =>
  (req.path.startsWith("/uploads") ? relaxed : strict)(req, res, next);

const MAX_DEPTH = 8;

export const stripUnsafeKeys = (value: unknown, depth = 0): unknown => {
  if (Array.isArray(value)) {
    return depth >= MAX_DEPTH ? [] : value.map((v) => stripUnsafeKeys(v, depth + 1));
  }
  if (value && typeof value === "object") {
    if (depth >= MAX_DEPTH) return {};
    const clean: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = stripUnsafeKeys(v, depth + 1);
    }
    return clean;
  }
  return value;
};

/** Express middleware: cleans body, query and URL params before any route sees them. */

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") req.body = stripUnsafeKeys(req.body);

  // Express 5 makes req.query a read-only getter (it re-parses the URL on each access),
  // so plain assignment throws. Defining the property directly works on Express 4 and 5.
  if (req.query) {
    Object.defineProperty(req, "query", {
      value: stripUnsafeKeys(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  if (req.params) {
    Object.defineProperty(req, "params", {
      value: stripUnsafeKeys(req.params),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  next();
};