import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import healthRoute from "./routes/health.route";
import authRoute from "./routes/auth.route";
import resourceRoute from "./routes/resource.route";
import uploadRoute from "./routes/upload.route";
import ingestionRoute from "./routes/ingestion.route";
import searchRoute from "./routes/search.route";
import chatRoute from "./routes/chat.route";
import savedRoute from "./routes/saved.route";
import deadlineRoute from "./routes/deadline.route";
import dashboardRoute from "./routes/dashboard.route";
import adminRoute from "./routes/admin.route";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiter";
import { securityHeaders, sanitizeInput } from "./middleware/ security";
import { parseAllowedOrigins } from "./config/env";

// Load environment variables from .env into process.env.
// This MUST run before anything reads process.env.
dotenv.config();

/**
 * Builds the Express app WITHOUT starting it. server.ts starts it; the tests
 * import this and send real requests to it. (Splitting "build" from "listen"
 * is what makes the whole app testable.)
 */
export const createApp = (): Application => {
  const app: Application = express();

  // Behind a proxy (Render, Railway, Docker + nginx...) the real client address
  // is in X-Forwarded-For. Without this, EVERY visitor looks like the proxy's IP
  // and shares one rate-limit bucket. Set TRUST_PROXY=1 when deployed.
  if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  }
  app.disable("x-powered-by");

  // ---- Global middleware (runs on every request, in this order) ----
  app.use(securityHeaders);

  // CORS: the browser only lets our frontend call this API if the API says so.
  
  const allowed = parseAllowedOrigins(process.env.CLIENT_URL);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
      credentials: true,
    })
  );

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
  }

  app.use(["/api/resources", "/api/ingestion"], express.json({ limit: "10mb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Strip Mongo operators ($ne, $gt...) from body/query/params before any route sees them.
  app.use(sanitizeInput);

  app.use("/api", generalLimiter);

  // ---- Routes ----
  app.use("/api/health", healthRoute);
  app.use("/api/auth", authRoute);
  app.use("/api/resources", resourceRoute);
  app.use("/api/uploads", uploadRoute);
  app.use("/api/ingestion", ingestionRoute);
  app.use("/api/search", searchRoute);
  app.use("/api/chat", chatRoute);
  app.use("/api/saved", savedRoute);
  app.use("/api/deadlines", deadlineRoute);
  app.use("/api/dashboard", dashboardRoute);
  app.use("/api/admin", adminRoute);


  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.get("/", (_req, res) => {
    res.send("CivicLens API - see /api/health for status");
  });

  // ---- Error handling ----
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp;