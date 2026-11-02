import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}


export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};


export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Libraries signal their own problems with a status/type instead of AppError:
  // body-parser (malformed or oversized JSON), Mongoose (bad id, failed
  // validation, duplicate key). Map them to the right 4xx instead of a blanket 500.
  const e = err as Error & { status?: number; statusCode?: number; type?: string; code?: number; path?: string; errors?: Record<string, { message: string }> };

  let statusCode = 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
  } else if (e.type === "entity.too.large") {
    statusCode = 413;
    message = "That request is too large.";
  } else if (e.type === "entity.parse.failed") {
    statusCode = 400;
    message = "The request body is not valid JSON.";
  } else if (e.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for "${e.path ?? "id"}".`;
  } else if (e.name === "ValidationError" && e.errors) {
    statusCode = 400;
    message = Object.values(e.errors).map((x) => x.message).join(" ");
  } else if (e.code === 11000) {
    statusCode = 409;
    message = "That already exists.";
  } else if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
    statusCode = e.status;
  }

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);
    // Never show internal messages (database errors, file paths...) to the public in production.
    if (process.env.NODE_ENV === "production") message = "Something went wrong on our side. Please try again.";
  } else if (process.env.NODE_ENV !== "test") {
    // Expected client mistakes (404s, bad input): one short line, not a stack trace.
    console.warn(`[${statusCode}] ${req.method} ${req.originalUrl} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only include the stack trace in development - never in production.
    stack: process.env.NODE_ENV === "development" && statusCode >= 500 ? err.stack : undefined,
  });
};