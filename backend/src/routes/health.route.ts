import { Router, Request, Response } from "express";
import mongoose from "mongoose";

const router = Router();

/**
 * GET /api/health
 *
 * Every real backend needs one of these. It's the very first thing:
 * - Postman/you use to confirm the server is running
 * - Docker/hosting platforms use to know if the container is healthy
 * - Later, the admin dashboard's "System Health" panel will call this
 */
router.get("/", (req: Request, res: Response) => {
  const dbStates: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    success: true,
    message: "CivicLens API is running",
    timestamp: new Date().toISOString(),
    database: dbStates[mongoose.connection.readyState] || "unknown",
  });
});

export default router;