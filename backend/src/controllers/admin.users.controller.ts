import { Request, Response } from "express";
import mongoose from "mongoose";
import User, { IUser } from "../models/User.model";
import Conversation from "../models/Conversation.model";
import SavedResource from "../models/SavedResource.model";
import Deadline from "../models/Deadline.model";
import QueryLog from "../models/QueryLog.model";
import { asyncHandler } from "../utils/asyncHandler";
import { escapeRegex, parsePaging } from "../utils/adminQuery";
import { AppError } from "../middleware/errorHandler";

const serialize = (
  user: IUser,
  currentUserId: string,
  activity?: { conversationCount: number; lastActiveAt: Date | null }
) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  conversationCount: activity?.conversationCount ?? 0,
  lastActiveAt: activity?.lastActiveAt ?? null,
  // Lets the UI hide the dangerous controls on the admin's own row.
  isSelf: String(user._id) === currentUserId,
});

/**
 * GET /api/admin/users?q=&role=&page=&limit=
 * Everyone, newest first, with how much each person has used the app.
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePaging(req.query);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const role = req.query.role;

  const filter: Record<string, unknown> = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  if (role === "user" || role === "admin") filter.role = role;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  // One grouped query for the whole page instead of one query per user.
  const ids = users.map((u) => u._id);
  const activityRows = ids.length
    ? await Conversation.aggregate([
        { $match: { user: { $in: ids } } },
        {
          $group: {
            _id: "$user",
            conversationCount: { $sum: 1 },
            lastActiveAt: { $max: "$updatedAt" },
          },
        },
      ])
    : [];
  const activity = new Map(activityRows.map((r) => [String(r._id), r]));
  const me = String(req.user!._id);

  res.status(200).json({
    success: true,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    users: users.map((u) => serialize(u, me, activity.get(String(u._id)))),
  });
});

/**
 * PATCH /api/admin/users/:id/role   body: { role: "user" | "admin" }
 * This replaces "edit the role by hand in MongoDB Compass".
 */
export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid user id", 400);
  }
  if (role !== "user" && role !== "admin") {
    throw new AppError("Role must be 'user' or 'admin'", 400);
  }

  // Stops an admin locking themselves (and possibly everyone) out by accident.
  if (String(req.user!._id) === id) {
    throw new AppError("You can't change your own role.", 400);
  }

  const target = await User.findById(id);
  if (!target) throw new AppError("User not found", 404);

  if (target.role !== role) {
    if (target.role === "admin" && role === "user") {
      const otherAdmins = await User.countDocuments({ role: "admin", _id: { $ne: target._id } });
      if (otherAdmins === 0) throw new AppError("At least one admin must remain.", 400);
    }
    target.role = role;
    await target.save();
  }

  res.status(200).json({ success: true, user: serialize(target, String(req.user!._id)) });
});

/**
 * DELETE /api/admin/users/:id
 * Removes the account and everything personal to it. Their past questions
 * stay in the analytics but are detached from them (anonymised), so usage
 * statistics don't change when someone leaves.
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid user id", 400);
  }
  if (String(req.user!._id) === id) {
    throw new AppError("You can't delete your own account here.", 400);
  }

  const target = await User.findById(id);
  if (!target) throw new AppError("User not found", 404);

  if (target.role === "admin") {
    const otherAdmins = await User.countDocuments({ role: "admin", _id: { $ne: target._id } });
    if (otherAdmins === 0) throw new AppError("At least one admin must remain.", 400);
  }

  // Data first, account last: if something fails midway the account still
  // exists and the delete can simply be retried.
  const [conversations, saved, deadlines] = await Promise.all([
    Conversation.deleteMany({ user: target._id }),
    SavedResource.deleteMany({ user: target._id }),
    Deadline.deleteMany({ user: target._id }),
    QueryLog.updateMany({ user: target._id }, { $unset: { user: 1 } }),
  ]);
  await User.deleteOne({ _id: target._id });

  res.status(200).json({
    success: true,
    removed: {
      conversations: conversations.deletedCount ?? 0,
      savedResources: saved.deletedCount ?? 0,
      deadlines: deadlines.deletedCount ?? 0,
    },
  });
});
