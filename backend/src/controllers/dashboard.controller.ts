import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.model";
import SavedResource from "../models/SavedResource.model";
import Deadline from "../models/Deadline.model";
import { fetchSavedResources } from "./saved.controller";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * GET /api/dashboard
 *
 * One request instead of four. The dashboard needs recent conversations,
 * saved resources, deadlines and a couple of counts; making the browser
 * fire four separate calls means four round trips and four chances for
 * the page to render half-loaded. Here the queries run in PARALLEL
 * (Promise.all) so total time is roughly the slowest one, not the sum.
 *
 * Conversations use an aggregation with $size so we get the message COUNT
 * without pulling every message body out of MongoDB just to count them.
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id as mongoose.Types.ObjectId;

  const [recentConversations, savedResources, savedCount, conversationCount, deadlines] =
    await Promise.all([
      Conversation.aggregate([
        { $match: { user: userId } },
        { $sort: { updatedAt: -1 } },
        { $limit: 5 },
        { $project: { title: 1, updatedAt: 1, messageCount: { $size: "$messages" } } },
      ]),
      fetchSavedResources(userId, 6),
      SavedResource.countDocuments({ user: userId }),
      Conversation.countDocuments({ user: userId }),
      // Incomplete only. Overdue ones are deliberately included (soonest
      // first puts them at the top) - a missed deadline is the MOST
      // important thing for the widget to keep showing.
      Deadline.find({ user: userId, completed: false }).sort({ dueDate: 1 }).limit(5).lean(),
    ]);

  res.status(200).json({
    success: true,
    stats: { savedCount, conversationCount },
    recentConversations: recentConversations.map((c) => ({
      id: c._id,
      title: c.title,
      messageCount: c.messageCount,
      updatedAt: c.updatedAt,
    })),
    savedResources,
    deadlines,
  });
});