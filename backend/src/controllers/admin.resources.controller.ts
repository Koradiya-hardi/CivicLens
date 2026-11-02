import { Request, Response } from "express";
import mongoose from "mongoose";
import Resource, { IResource } from "../models/Resource.model";
import Chunk from "../models/Chunk.model";
import { asyncHandler } from "../utils/asyncHandler";
import { escapeRegex, parsePaging } from "../utils/adminQuery";
import { deleteResourceCascade } from "../services/resourceCleanup.service";
import { AppError } from "../middleware/errorHandler";

const CATEGORIES: string[] = (Resource.schema.path("category") as any).enumValues;

/** Never includes `content` - a full handbook is far too heavy for a list. */
const serialize = (resource: IResource, chunkCount: number) => {
  const creator = resource.createdBy as unknown as { name?: string } | null;
  return {
    id: resource._id,
    title: resource.title,
    category: resource.category,
    description: resource.description,
    isPublished: resource.isPublished,
    fileName: resource.fileName ?? null,
    fileType: resource.fileType ?? null,
    fileSize: resource.fileSize ?? null,
    sourceUrl: resource.sourceUrl ?? null,
    createdByName: creator && creator.name ? creator.name : null,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    chunkCount,
    // Visible to users AND actually findable by search. A published document
    // with 0 chunks looks fine in the library but can never be found by
    // meaning - the most common silent failure, so it gets its own flag.
    searchable: resource.isPublished && chunkCount > 0,
  };
};

/**
 * GET /api/admin/resources?q=&status=&category=&page=&limit=
 * Unlike the public list this INCLUDES drafts, and reports how many search
 * chunks each document has.
 */
export const listAdminResources = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaging(req.query);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const { status, category } = req.query;

  const filter: Record<string, unknown> = {};
  if (q) filter.title = new RegExp(escapeRegex(q), "i");
  if (status === "published") filter.isPublished = true;
  if (status === "draft") filter.isPublished = false;
  if (typeof category === "string" && category) {
    if (!CATEGORIES.includes(category)) throw new AppError("Unknown category", 400);
    filter.category = category;
  }

  const [resources, total] = await Promise.all([
    Resource.find(filter)
      .select("-content")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Resource.countDocuments(filter),
  ]);

  const ids = resources.map((r) => r._id);
  const counts = ids.length
    ? await Chunk.aggregate([
        { $match: { resource: { $in: ids } } },
        { $group: { _id: "$resource", count: { $sum: 1 } } },
      ])
    : [];
  const chunkCounts = new Map(counts.map((c) => [String(c._id), c.count as number]));

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    resources: resources.map((r) => serialize(r, chunkCounts.get(String(r._id)) ?? 0)),
  });
});

/**
 * PATCH /api/admin/resources/:id/publish   body: { isPublished: boolean }
 * Draft <-> published without re-sending the whole document.
 */
export const setPublished = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isPublished } = req.body;

  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid resource id", 400);
  }
  if (typeof isPublished !== "boolean") {
    throw new AppError("isPublished must be true or false", 400);
  }

  const resource = await Resource.findByIdAndUpdate(id, { isPublished }, { new: true })
    .select("-content")
    .populate("createdBy", "name");
  if (!resource) throw new AppError("Resource not found", 404);

  const chunkCount = await Chunk.countDocuments({ resource: resource._id });

  res.status(200).json({
    success: true,
    resource: serialize(resource, chunkCount),
    // Publishing something that was never indexed: tell the UI to warn.
    needsIndexing: isPublished && chunkCount === 0,
  });
});

/**
 * DELETE /api/admin/resources/:id
 * Removes the document, its search chunks, everyone's bookmarks of it, and
 * its uploaded file - not just the one database row.
 */
export const deleteAdminResource = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid resource id", 400);
  }

  const resource = await Resource.findById(id);
  if (!resource) throw new AppError("Resource not found", 404);

  const removed = await deleteResourceCascade(resource);

  res.status(200).json({ success: true, removed });
});
