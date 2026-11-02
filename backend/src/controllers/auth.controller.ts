import { Request, Response } from "express";
import { validationResult } from "express-validator";
import User from "../models/User.model";
import { generateToken } from "../utils/generateToken";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";

/**
 * Small shared helper: build the consistent JSON shape we send back
 * after successful register/login. Keeping this in one place means the
 * frontend can always rely on the exact same response structure.
 */
const sendAuthResponse = (
  res: Response,
  statusCode: number,
  user: { _id: unknown; name: string; email: string; role: string }
) => {
  const token = generateToken(String(user._id));

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

/**
 * POST /api/auth/register
 *
 * express-validator has already run as middleware before this function
 * (see auth.route.ts) - validationResult(req) collects any validation
 * failures it found. We check that FIRST, before touching the database.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { name, email, password } = req.body;

  // Check for an existing account with this email BEFORE attempting to
  // create one. We could rely solely on MongoDB's unique index and catch
  // the duplicate-key error, but checking explicitly lets us return a
  // clean, friendly error message instead of a raw DB error.
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  // Note: we pass the PLAIN password here - the pre-save hook in
  // User.model.ts hashes it automatically before it touches the database.
  const user = await User.create({ name, email, password });

  sendAuthResponse(res, 201, user);
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { email, password } = req.body;

  // .select("+password") is required because the schema sets
  // `select: false` on the password field (see User.model.ts) - normally
  // it's excluded from query results for safety, but we need it here to
  // actually compare it against what the user typed.
  const user = await User.findOne({ email }).select("+password");

  // Deliberately vague error message. If we said "email not found" vs
  // "wrong password" as DIFFERENT messages, an attacker could use that to
  // figure out which emails have accounts (an "enumeration" attack).
  // One identical message for both cases closes that gap.
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }

  sendAuthResponse(res, 200, user);
});

/**
 * GET /api/auth/me
 * Protected route - only reachable if the `protect` middleware already
 * verified the JWT and attached the user to req.user (see auth.middleware.ts).
 * Useful for the frontend to check "is my stored token still valid?" and
 * fetch the current user's profile on app load.
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});
 
/**
 * GET /api/auth/users
 * Admin-only. This is the first route that actually uses `authorize("admin")`
 * from auth.middleware.ts - protect() confirms you're logged in, authorize()
 * then confirms your role is "admin" specifically, and only then does this
 * function run.
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select("-password");
  res.status(200).json({
    success: true,
    count: users.length,
    users,
  });
});
 