import { Request, Response } from "express";
import fs from "fs";
import mongoose from "mongoose";
import Resource from "../models/Resource.model";
import Chunk from "../models/Chunk.model";
import { UPLOAD_ROOT } from "../config/upload.config";
import { extractTextFromFile } from "../services/textExtractor.service";
import { generateEmbeddings } from "../services/embedding.service";
import { chunkText } from "../utils/chunkText";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";

/**
 * Converts a fileUrl like "/uploads/2026/09/abc-file.pdf" (what
 * POST /api/uploads returns) back into the real path on disk where that
 * file actually lives, so we can open and read it.
 */
const resolveFileUrlToDiskPath = (fileUrl: string): string => {
  const relative = fileUrl.replace(/^\/uploads\//, "");
  return `${UPLOAD_ROOT}/${relative}`;
};

/**
 * POST /api/ingestion/preview
 * Admin only. Body: { fileUrl }
 *
 * Day 1 deliverable: given a file already uploaded via POST /api/uploads,
 * extract its raw text and show how it would be chunked - WITHOUT saving
 * anything to the database yet. This lets an admin sanity-check that
 * extraction actually worked (PDFs can be messy) before committing to
 * using that text as a Resource's content.
 *
 * The intended workflow: upload a PDF -> preview extraction here -> copy
 * the returned fullText into the "content" field when calling
 * POST /api/resources to actually create the Resource.
 */
export const previewExtraction = asyncHandler(async (req: Request, res: Response) => {
  const { fileUrl } = req.body;

  if (!fileUrl || typeof fileUrl !== "string") {
    throw new AppError("fileUrl is required", 400);
  }

  const diskPath = resolveFileUrlToDiskPath(fileUrl);

  if (!fs.existsSync(diskPath)) {
    throw new AppError("File not found on disk for the given fileUrl", 404);
  }

  const fullText = await extractTextFromFile(diskPath);

  if (!fullText || fullText.trim().length === 0) {
    throw new AppError(
      "No text could be extracted from this file (it may be a scanned/image-only PDF)",
      422
    );
  }

  const chunks = chunkText(fullText);

  res.status(200).json({
    success: true,
    characterCount: fullText.length,
    chunkCount: chunks.length,
    fullText,
    chunks,
  });
});

/**
 * POST /api/ingestion/:resourceId
 * Admin only.
 *
 * Day 2 deliverable: the actual embed-and-store pipeline.
 *   1. Load the Resource's `content` field (already finalized text - see
 *      previewExtraction above for how an admin gets that text in the
 *      first place)
 *   2. Chunk it
 *   3. Generate an embedding for every chunk (one batched OpenAI call)
 *   4. Wipe any previously-stored chunks for this Resource (makes
 *      re-ingesting after an edit safe/idempotent - no stale duplicates)
 *   5. Save the new chunks with their embeddings
 *
 * This does NOT yet let anyone SEARCH by embedding - that's Day 3, once
 * the Atlas Vector Search index exists. Today's job is making sure the
 * vectors are being generated and stored correctly in the first place.
 */
export const ingestResource = asyncHandler(async (req: Request, res: Response) => {
  const { resourceId } = req.params;

  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  if (!resource.content || resource.content.trim().length === 0) {
    throw new AppError("This resource has no content to ingest", 400);
  }

  const chunks = chunkText(resource.content);
  if (chunks.length === 0) {
    throw new AppError("Chunking produced zero chunks - check resource content", 400);
  }

  // One batched API call for ALL chunks, not one call per chunk - see the
  // comment in embedding.service.ts for why this matters.
  const embeddings = await generateEmbeddings(chunks);

  // Idempotent re-ingestion: if this resource was ingested before (e.g. an
  // admin edited the content and wants fresh chunks), remove the old ones
  // first so we never end up with duplicate/stale chunks answering questions.
  await Chunk.deleteMany({ resource: resource._id });

  const chunkDocs = chunks.map((text, index) => ({
    resource: resource._id,
    chunkIndex: index,
    text,
    embedding: embeddings[index],
  }));

  const saved = await Chunk.insertMany(chunkDocs);

  res.status(201).json({
    success: true,
    resourceId: resource._id,
    chunkCount: saved.length,
    // Small sample so you can immediately eyeball that embeddings look
    // real (1536 numbers) without dumping the entire, very large response.
    sample: {
      chunkIndex: saved[0].chunkIndex,
      text: saved[0].text.slice(0, 200),
      embeddingLength: saved[0].embedding.length,
      embeddingPreview: saved[0].embedding.slice(0, 5),
    },
  });
});