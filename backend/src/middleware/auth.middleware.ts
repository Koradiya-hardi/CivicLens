import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User.model";
import { AppError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Extends Express's Request type so TypeScript knows req.user can exist.
 * Declaration merging - we're adding to an interface Express already
 * defines, not creating a new one. This needs to live somewhere that gets
 * picked up by the TS compiler; simplest is right here since this is the
 * only file that sets req.user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Middleware that protects a route - only requests with a valid JWT get
 * through. Any route that should require login uses this, e.g.:
 *
 *   router.get("/me", protect, getMe);
 *
 * How it works:
 * 1. Look for "Authorization: Bearer <token>" header
 * 2. Verify the token's signature with our JWT_SECRET (proves it wasn't
 *    tampered with and was actually issued by us)
 * 3. Decode the user id out of it
 * 4. Look that user up fresh in the database (so we always have current
 *    data, not whatever was true when the token was issued)
 * 5. Attach the user to req.user so every handler after this one can use it
 */
export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Not authorized, no token provided", 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError("Server misconfiguration: JWT_SECRET missing", 500);
    }

    let decoded: { id: string };
    try {
      decoded = jwt.verify(token, secret) as { id: string };
    } catch (err) {
      // Covers both an invalid signature (tampered/fake token) and an
      // expired token (jwt.verify throws TokenExpiredError automatically
      // once `exp` has passed) - both mean "not authorized" to the client.
      throw new AppError("Not authorized, token invalid or expired", 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      // Token is valid but the user it points to no longer exists
      // (e.g. account was deleted) - treat it the same as unauthorized.
      throw new AppError("Not authorized, user no longer exists", 401);
    }

    req.user = user;
    next();
  }
);

/**
 * Role-gate middleware, built for tomorrow (Day 3) but the shape is worth
 * laying down now since `protect` already gives us req.user.role for free.
 * Usage: router.delete("/users/:id", protect, authorize("admin"), ...)
 */
export const authorize = (...allowedRoles: Array<"user" | "admin">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};