import rateLimit from "express-rate-limit";

/**
 * Strict limiter for login/register specifically.
  10 attempts per 15 minutes per IP is generous enough for a real user
  who fat-fingers their password a few times, but useless for a brute-force
  script trying thousands of combinations.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true, // adds RateLimit-* headers so clients can see their remaining quota
  legacyHeaders: false,
});

// Looser, general-purpose limiter for the rest of the API.

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 300, not 100: one page load of the dashboard or admin panel is several
  // requests, and a whole campus can share one IP address.
  max: 300,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});


export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CHAT_RATE_LIMIT_PER_MIN) || 15,
  keyGenerator: (req) => {
    const id = (req as unknown as { user?: { _id?: unknown } }).user?._id;
    return id ? `user:${String(id)}` : `ip:${req.ip ?? "unknown"}`;
  },
  message: {
    success: false,
    message: "You're asking questions very quickly - please wait a moment and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});