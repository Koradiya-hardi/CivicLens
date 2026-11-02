import { Request, Response } from "express";
import path from "path";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { UPLOAD_ROOT } from "../config/upload.config";

/**
 * POST /api/uploads
 * Admin only. Expects multipart/form-data with a field named "file".
 *
 * By the time this function runs, `handleFileUpload` middleware has
 * already: validated the file type, checked the size limit, and physically
 * saved the file to disk at req.file.path. Our job here is just to build
 * a clean response describing what got saved.
 *
 * WHY a separate upload step instead of attaching the file directly to
 * the "create resource" request? This mirrors how real-world file storage
 * works: you upload a file to get back a URL/key, THEN you reference that
 * URL when creating/updating the actual record (Resource, in our case).
 * It also means the same upload endpoint could be reused later for other
 * things (profile pictures, etc.) without being tied to Resources specifically.
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError("No file was provided", 400);
  }

  // req.file.path is the FULL disk path (e.g. /home/user/civiclens/backend/uploads/2026/09/abc-file.pdf).
  // We never want to expose that full server filesystem path to the client -
  // instead we compute a relative "url" the frontend can actually use,
  // e.g. "/uploads/2026/09/abc-file.pdf", which we'll serve via
  // express.static in server.ts.
  const relativePath = path.relative(UPLOAD_ROOT, req.file.path).split(path.sep).join("/");
  const fileUrl = `/uploads/${relativePath}`;

  res.status(201).json({
    success: true,
    file: {
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    },
  });
});