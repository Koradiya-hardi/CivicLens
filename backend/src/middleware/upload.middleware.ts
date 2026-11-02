import { Request, Response, NextFunction } from "express";
import { upload } from "../config/upload.config";
import { AppError } from "./errorHandler";

/**
 * multer's `upload.single("file")` is itself a piece of middleware, but
 * when it fails (wrong file type from our fileFilter, file too large, no
 * file provided at all), it calls next(err) with either a plain Error or
 * a multer.MulterError - NEITHER of which is our AppError class. Left
 * alone, our errorHandler would treat these as generic 500s, which is
 * both wrong (a bad upload from the CLIENT is a 400, not a server fault)
 * and unhelpful (no clear message reaches the frontend).
 *
 * This wraps that middleware and translates whatever it throws into a
 * proper AppError(message, 400) before passing it along.
 */
export const handleFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const singleFileUpload = upload.single("file");

  singleFileUpload(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "File upload failed";
      return next(new AppError(message, 400));
    }
    next();
  });
};