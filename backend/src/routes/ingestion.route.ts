import { Router } from "express";
import { previewExtraction, ingestResource } from "../controllers/ingestion.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

// Day 1: preview what extraction + chunking would produce for an uploaded file
router.post("/preview", protect, authorize("admin"), previewExtraction);

// Day 2: actually generate embeddings for a Resource's content and store them
router.post("/:resourceId", protect, authorize("admin"), ingestResource);

export default router;