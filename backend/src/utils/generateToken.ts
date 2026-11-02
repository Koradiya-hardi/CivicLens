import jwt, { SignOptions } from "jsonwebtoken";

/**
 * Creates a signed JWT containing the user's id.
 *
 * Why only put the user id in the token, not the whole user object?
 * - Tokens are visible (base64-decodable) to anyone who has them - never put
 *   sensitive data in a JWT payload.
 * - Keeping it minimal means if we change the user's name/email/role later,
 *   we don't need to worry about a stale token carrying old data - we just
 *   look the user up fresh from the id every time (see auth.middleware.ts).
 */
export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Same "fail fast" philosophy as the DB connection - a missing secret
    // is a deployment/config mistake, not something to silently work around.
    throw new Error("JWT_SECRET is not set in environment variables");
  }

  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };

  return jwt.sign({ id: userId }, secret, options);
};