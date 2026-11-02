export interface EnvReport {
  errors: string[];
  warnings: string[];
}

const WEAK_SECRETS = new Set(["secret", "changeme", "change-me", "testsecret", "your_jwt_secret", "your-secret-key"]);

/**
 * Checks the environment variables the server needs, so a typo or a missing value is reported clearly at startup instead of as a confusing failure later.
 *  Pure function (takes the env as an argument) so it can be tested.
 */
export const checkEnv = (env: NodeJS.ProcessEnv): EnvReport => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === "production";

  if (!env.MONGODB_URI) errors.push("MONGODB_URI is not set.");

  if (!env.JWT_SECRET) {
    errors.push("JWT_SECRET is not set.");
  } else if (production && (env.JWT_SECRET.length < 32 || WEAK_SECRETS.has(env.JWT_SECRET.toLowerCase()))) {
    errors.push("JWT_SECRET is too weak for production - use a random string of at least 32 characters.");
  } else if (env.JWT_SECRET.length < 16) {
    warnings.push("JWT_SECRET is short; use a longer random value before deploying.");
  }

  if (!env.GEMINI_API_KEY) warnings.push("GEMINI_API_KEY is not set - chat answers will fail until it is.");

  if (production && !env.CLIENT_URL) {
    errors.push("CLIENT_URL is not set - in production the API must know which website may call it (CORS).");
  }

  if (env.PORT && Number.isNaN(Number(env.PORT))) errors.push(`PORT must be a number (got "${env.PORT}").`);

  return { errors, warnings };
};

// Prints warnings 
export const validateEnv = (): void => {
  const { errors, warnings } = checkEnv(process.env);
  warnings.forEach((w) => console.warn(`[config] warning: ${w}`));
  if (errors.length > 0) {
    errors.forEach((e) => console.error(`[config] error: ${e}`));
    console.error("[config] Fix the values above in backend/.env and restart.");
    process.exit(1);
  }
};

/** CLIENT_URL may hold several comma-separated origins (e.g. a Vercel URL and localhost). */
export const parseAllowedOrigins = (raw: string | undefined): string[] =>
  (raw || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);