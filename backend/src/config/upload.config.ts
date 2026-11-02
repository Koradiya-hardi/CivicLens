import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * We store files on local disk for now, organized the way S3 keys usually
 * look: uploads/<year>/<month>/<random-id>-<original-filename>.
 *
 * Why organize it this way even though it's just a local folder today?
 * - Splitting into year/month subfolders keeps any single folder from
 *   holding tens of thousands of files (slow to list, awkward to browse).
 * - The random id prevents two different admins uploading "handbook.pdf"
 *   from overwriting each other's file.
 * - If/when we move to real S3 in production, the "key" (path) structure
 *   we're already using maps directly onto an S3 object key - swapping
 *   the storage engine later (disk -> S3) won't require rethinking how
 *   paths are organized, just where they physically live.
 */
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

const buildDestinationPath = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const destDir = path.join(UPLOAD_ROOT, year, month);

  // Multer does NOT create folders for you - if this directory doesn't
  // exist yet, the upload silently fails. We create it (recursively, so
  // it makes both the year AND month folder in one call) right before
  // every upload just in case this is the first file of a new month.
  fs.mkdirSync(destDir, { recursive: true });

  return destDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, buildDestinationPath());
  },
  filename: (req, file, cb) => {
    // crypto.randomUUID() guarantees no two uploads ever collide, even if
    // two admins upload a file called "handbook.pdf" at the same second.
    const uniqueId = crypto.randomUUID();
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${uniqueId}-${safeOriginalName}`);
  },
});

/**
 * Whitelist of accepted file types - both by MIME type (what the browser
 * claims the file is) AND file extension (belt-and-suspenders, since MIME
 * type can be spoofed/wrong). We reject anything else with a clear message
 * instead of silently accepting something we can't safely process.
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".docx"]);

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    // Passing an Error here causes multer to reject the file. We catch
    // this specific case in upload.route.ts and turn it into a clean
    // 400 response instead of a raw 500.
    return cb(new Error("Only PDF, TXT, and DOCX files are allowed"));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB - generous for a handbook PDF, small enough to not clog the server/disk
  },
});

export { UPLOAD_ROOT };