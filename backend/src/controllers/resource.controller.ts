import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Resource from "../models/Resource.model";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { deleteResourceCascade } from "../services/resourceCleanup.service";

/**
 * GET /api/resources
 * Public - anyone can browse resources, logged in or not.
 *
 * Supports optional query params:
 *   ?category=Transportation   -> filter by exact category
 *   ?search=parking permit     -> keyword search across title/description/content
 *   ?page=2&limit=10           -> pagination
 *
 * Example: /api/resources?category=Transportation&search=license&page=1&limit=10
 */
export const getResources = asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;

  // Only non-admins should ever see this endpoint filtered to published-only.
  // Since this route has no `protect` middleware, req.user is always
  // undefined here, so we always filter to published content - unpublished
  // drafts are only reachable via the admin-specific flows later.
  const filter: Record<string, unknown> = { isPublished: true };

  if (category) {
    filter.category = category;
  }

  if (search) {
    // $text search requires the text index we defined on the schema.
    filter.$text = { $search: search as string };
  }

  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // cap at 100 so nobody can request an absurd page size
  const skip = (page - 1) * limit;

  const [resources, total] = await Promise.all([
    Resource.find(filter)
      .select(search ? { score: { $meta: "textScore" } } : {}) // include relevance score when searching
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name"), // swaps the raw ObjectId for { name: "..." }
    Resource.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: resources.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    resources,
  });
});

/**
 * GET /api/resources/:id
 * Public - single resource by id.
 */
export const getResourceById = asyncHandler(async (req: Request, res: Response) => {
  const resourceId = req.params.id;
  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  const resource = await Resource.findOne({
    _id: resourceId,
    isPublished: true,
  }).populate("createdBy", "name");

  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  res.status(200).json({
    success: true,
    resource,
  });
});

/**
 * POST /api/resources
 * Admin only (enforced in the route file via protect + authorize("admin")).
 */
export const createResource = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const {
    title,
    category,
    description,
    content,
    tags,
    sourceUrl,
    isPublished,
    fileUrl,
    fileName,
    fileType,
    fileSize,
  } = req.body;

  // req.user is guaranteed to exist here because this route is behind
  // `protect` middleware - TypeScript doesn't know that automatically,
  // but we know it from how the route is wired.
  const resource = await Resource.create({
    title,
    category,
    description,
    content,
    tags,
    sourceUrl,
    isPublished,
    fileUrl,
    fileName,
    fileType,
    fileSize,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    resource,
  });
});

/**
 * PUT /api/resources/:id
 * Admin only.
 */
export const updateResource = asyncHandler(async (req: Request, res: Response) => {
  const resourceId = req.params.id;
  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const {
    title,
    category,
    description,
    content,
    tags,
    sourceUrl,
    isPublished,
    fileUrl,
    fileName,
    fileType,
    fileSize,
  } = req.body;

  // { new: true } tells Mongoose to return the UPDATED document, not the
  // one as it was before the update - without it we'd get stale data back.
  // runValidators re-applies our schema rules (e.g. category enum) on update,
  // since Mongoose does NOT validate on update by default like it does on create.
  const resource = await Resource.findByIdAndUpdate(
    resourceId,
    {
      title,
      category,
      description,
      content,
      tags,
      sourceUrl,
      isPublished,
      fileUrl,
      fileName,
      fileType,
      fileSize,
    },
    { new: true, runValidators: true }
  );

  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  res.status(200).json({
    success: true,
    resource,
  });
});

/**
 * DELETE /api/resources/:id
 * Admin only.
 */
export const deleteResource = asyncHandler(async (req: Request, res: Response) => {
  const resourceId = req.params.id;
  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  const resource = await Resource.findById(resourceId);

  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  // WEEK 6: also removes the document's search chunks, everyone's bookmarks
  // of it, and its uploaded file - not just this one database row.
  await deleteResourceCascade(resource);

  res.status(200).json({
    success: true,
    message: "Resource deleted successfully",
  });
});
