import mongoose from "mongoose";
import createApp from "./app";
import connectDB from "./config/db";
import { validateEnv } from "./config/env";
import { generateEmbedding } from "./services/embedding.service";
// app.ts has already loaded .env (dotenv) by the time this runs.
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Stop immediately, with a clear message, if a required setting is missing.
  validateEnv();

  // Why wait for the database? If MongoDB isn't reachable we don't want the
  // API to come up and accept requests it can't fulfil.
  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`CivicLens API running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.WARM_EMBEDDINGS === "1") {
      generateEmbedding("warm up")
        .then(() => console.log("[warmup] embedding model ready"))
        .catch((err) => console.warn("[warmup] failed (it will retry on first use):", err.message));
    }
  });

  // Graceful shutdown: when Docker/Render stops the container (SIGTERM) or you
  // press Ctrl+C, finish in-flight requests and close the database instead of
  // cutting everything off mid-answer.
  const shutdown = (signal: string) => {
    console.log(`${signal} received - shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    // If something hangs (e.g. a long streaming answer), force-exit after 10 s.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();