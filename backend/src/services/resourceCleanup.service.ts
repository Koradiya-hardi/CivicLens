import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Resource, { IResource } from "../models/Resource.model";
import Chunk from "../models/Chunk.model";
import SavedResource from "../models/SavedResource.model";
import { UPLOAD_ROOT } from "../config/upload.config";


export const resolveUploadPath = (fileUrl?: string | null): string | null => {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return null;

  const root = path.resolve(UPLOAD_ROOT) + path.sep;
  const full = path.resolve(UPLOAD_ROOT, fileUrl.slice("/uploads/".length));

  return full.startsWith(root) ? full : null;
};

export interface CascadeResult {
  chunksRemoved: number;
  savesRemoved: number;
  fileRemoved: boolean;
}

/**
 * Deletes a document AND everything that hangs off it:
 *   - its embedded chunks (otherwise they'd linger as orphaned search data)
 *   - every user's "saved" bookmark of it
 *   - the uploaded file on disk (unless another document still uses it)
 *
 * Both the admin panel and the original DELETE /api/resources/:id use this,
 * so there is exactly one definition of "delete a document".
 */
export const deleteResourceCascade = async (resource: IResource): Promise<CascadeResult> => {
  const [chunks, saves] = await Promise.all([
    Chunk.deleteMany({ resource: resource._id }),
    SavedResource.deleteMany({ resource: resource._id }),
  ]);

  await Resource.deleteOne({ _id: resource._id });

  // File last: if this fails the database is already consistent.
  let fileRemoved = false;
  const filePath = resolveUploadPath(resource.fileUrl);
  if (filePath) {
    const stillUsed = await Resource.countDocuments({ fileUrl: resource.fileUrl });
    if (stillUsed === 0) {
      try {
        await fs.promises.unlink(filePath);
        fileRemoved = true;
      } catch {
        /* already gone, or not removable - not worth failing the delete */
      }
    }
  }

  return {
    chunksRemoved: chunks.deletedCount ?? 0,
    savesRemoved: saves.deletedCount ?? 0,
    fileRemoved,
  };
};

const idsMissingFromResources = async (ids: mongoose.Types.ObjectId[]) => {
  if (ids.length === 0) return [];
  const existing = await Resource.find({ _id: { $in: ids } }).select("_id").lean();
  const present = new Set(existing.map((r) => String(r._id)));
  return ids.filter((id) => !present.has(String(id)));
};

/** Counts (without deleting) chunks / saves whose document no longer exists. */
export const countOrphans = async () => {
  const [chunkIds, savedIds] = await Promise.all([
    Chunk.distinct("resource"),
    SavedResource.distinct("resource"),
  ]);
  const [missingChunkIds, missingSavedIds] = await Promise.all([
    idsMissingFromResources(chunkIds),
    idsMissingFromResources(savedIds),
  ]);

  const [orphanChunks, orphanSaves] = await Promise.all([
    missingChunkIds.length ? Chunk.countDocuments({ resource: { $in: missingChunkIds } }) : 0,
    missingSavedIds.length ? SavedResource.countDocuments({ resource: { $in: missingSavedIds } }) : 0,
  ]);

  return { orphanChunks, orphanSaves, missingChunkIds, missingSavedIds };
};

/** Removes the orphans counted above (left behind by pre-Week-6 deletes). */
export const cleanupOrphans = async () => {
  const { missingChunkIds, missingSavedIds } = await countOrphans();

  const [chunks, saves] = await Promise.all([
    missingChunkIds.length ? Chunk.deleteMany({ resource: { $in: missingChunkIds } }) : null,
    missingSavedIds.length ? SavedResource.deleteMany({ resource: { $in: missingSavedIds } }) : null,
  ]);

  return { chunksRemoved: chunks?.deletedCount ?? 0, savesRemoved: saves?.deletedCount ?? 0 };
};
