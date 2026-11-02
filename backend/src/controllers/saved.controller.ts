import { Request, Response } from "express";
import mongoose from "mongoose";
import SavedResource from "../models/SavedResource.model";
import Resource from "../models/Resource.model";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";

interface PopulatedSaved {
  createdAt: Date;
  resource: {
    _id: mongoose.Types.ObjectId;
    title: string;
    category: string;
    description: string;
    isPublished: boolean;
  } | null;
}

/**
 * Shared by GET /api/saved and the dashboard. Returns the user's saved
 * resources, newest first, as plain summaries.
 *
 * `resource` can come back null if the admin deleted it after the user
 * saved it (we don't cascade-delete bookmarks), and unpublished drafts
 * shouldn't be visible either - so both are filtered out here rather than
 * leaking a broken card to the frontend.
 */
export const fetchSavedResources = async (
  userId: mongoose.Types.ObjectId,
  limit?: number
) => {
  let query = SavedResource.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate("resource", "title category description isPublished")
    .lean();

  if (limit) query = query.limit(limit);

  const saved = (await query) as unknown as PopulatedSaved[];

  return saved
    .filter((s) => s.resource && s.resource.isPublished)
    .map((s) => ({
      _id: String(s.resource!._id),
      title: s.resource!.title,
      category: s.resource!.category,
      description: s.resource!.description,
      savedAt: s.createdAt,
    }));
};

/** GET /api/saved */
export const listSaved = asyncHandler(async (req: Request, res: Response) => {
  const resources = await fetchSavedResources(req.user!._id as mongoose.Types.ObjectId);
  res.status(200).json({ success: true, count: resources.length, resources });
});

/**
 * POST /api/saved/:resourceId
 * Idempotent: saving something that's already saved is a success, not an
 * error. The unique index is the real guard against duplicates - we just
 * swallow its "duplicate key" error (code 11000), which also makes two
 * simultaneous clicks safe.
 */
export const saveResource = asyncHandler(async (req: Request, res: Response) => {
  const resourceId = req.params.resourceId;

  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  const resource = await Resource.findOne({ _id: resourceId, isPublished: true }).select("_id");
  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  try {
    await SavedResource.create({ user: req.user!._id, resource: resource._id });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
  }

  res.status(200).json({ success: true, saved: true });
});

/** DELETE /api/saved/:resourceId - also idempotent. */
export const unsaveResource = asyncHandler(async (req: Request, res: Response) => {
  const resourceId = req.params.resourceId;

  if (typeof resourceId !== "string" || !mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new AppError("Invalid resource id", 400);
  }

  await SavedResource.deleteOne({ user: req.user!._id, resource: resourceId });

  res.status(200).json({ success: true, saved: false });
});