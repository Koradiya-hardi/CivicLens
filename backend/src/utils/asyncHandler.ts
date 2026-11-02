import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express does NOT automatically catch errors thrown inside an async
 * function - if you `throw` (or a promise rejects) inside an `async`
 * route handler without a try/catch, the request just hangs forever
 * instead of hitting our errorHandler.
 *
 * Rather than writing try/catch in every single controller, we wrap
 * each handler once with this function. It runs the handler, and if
 * it throws/rejects, forwards the error to next() - which sends it
 * straight to our centralized errorHandler middleware.
 */
export const asyncHandler =
  (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };