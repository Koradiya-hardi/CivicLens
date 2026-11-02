import { Request, Response } from "express";
import User from "../models/User.model";
import Resource from "../models/Resource.model";
import Chunk from "../models/Chunk.model";
import Conversation from "../models/Conversation.model";
import SavedResource from "../models/SavedResource.model";
import Deadline from "../models/Deadline.model";
import QueryLog from "../models/QueryLog.model";
import { asyncHandler } from "../utils/asyncHandler";

const DAY_MS = 24 * 60 * 60 * 1000;
const round = (value: number, places: number) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const clampDays = (value: unknown) => {
  const n = parseInt(String(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 90) : 30;
};

/**
 * GET /api/admin/analytics?days=30
 *
 * One call returns everything the Overview screen shows:
 *   totals       - how big the system is right now
 *   usage        - what happened inside the chosen window
 *   series       - questions + searches per day (zero-filled, for the chart)
 *   topQueries   - the most-asked / most-searched things
 *   topCategories- which topics people actually want
 *   unanswered   - questions the library could NOT answer = what to add next
 *
 * The window is whole UTC days (today plus the `days - 1` before it), so the
 * chart's bars always add up to the headline numbers.
 */
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const days = clampDays(req.query.days);

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMs = todayStart - (days - 1) * DAY_MS;
  const since = new Date(sinceMs);

  const inWindow = { createdAt: { $gte: since } };

  const [
    userCount,
    adminCount,
    published,
    drafts,
    chunkCount,
    conversationCount,
    savedCount,
    deadlineCount,
    messageAgg,
    outcomeAgg,
    seriesAgg,
    activeUserIds,
    newUsers,
    topQueriesAgg,
    topCategoriesAgg,
    unansweredAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    Resource.countDocuments({ isPublished: true }),
    Resource.countDocuments({ isPublished: false }),
    Chunk.countDocuments(),
    Conversation.countDocuments(),
    SavedResource.countDocuments(),
    Deadline.countDocuments(),
    Conversation.aggregate([
      { $group: { _id: null, total: { $sum: { $size: "$messages" } } } },
    ]),
    QueryLog.aggregate([
      { $match: inWindow },
      { $group: { _id: { source: "$source", outcome: "$outcome" }, n: { $sum: 1 } } },
    ]),
    QueryLog.aggregate([
      { $match: inWindow },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
            source: "$source",
          },
          n: { $sum: 1 },
        },
      },
    ]),
    Conversation.distinct("user", { updatedAt: { $gte: since } }),
    User.countDocuments({ createdAt: { $gte: since } }),
    // Most asked: group "Leave?" and "leave" together via `normalized`.
    QueryLog.aggregate([
      { $match: { ...inWindow, normalized: { $ne: "" } } },
      { $sort: { createdAt: -1 } }, // so $first below is the most recent wording
      {
        $group: {
          _id: "$normalized",
          sample: { $first: "$query" },
          count: { $sum: 1 },
          lastAsked: { $max: "$createdAt" },
          avgScore: { $avg: "$topScore" },
          answered: { $sum: { $cond: [{ $in: ["$outcome", ["answered", "results"]] }, 1, 0] } },
        },
      },
      { $sort: { count: -1, lastAsked: -1 } },
      { $limit: 10 },
    ]),
    // Topics: only counted when something relevant WAS found, so a failed
    // search can't wrongly credit a category.
    QueryLog.aggregate([
      {
        $match: {
          ...inWindow,
          outcome: { $in: ["answered", "results"] },
          topCategory: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$topCategory", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    // Content gaps: asked, but nothing good enough was found.
    QueryLog.aggregate([
      { $match: { ...inWindow, outcome: { $in: ["no_answer", "no_results"] }, normalized: { $ne: "" } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$normalized",
          sample: { $first: "$query" },
          count: { $sum: 1 },
          lastAsked: { $max: "$createdAt" },
          bestScore: { $max: "$topScore" },
        },
      },
      { $sort: { count: -1, lastAsked: -1 } },
      { $limit: 10 },
    ]),
  ]);

  // ---- window totals ----
  const outcomeCount = (source: string, outcome: string) =>
    outcomeAgg.find((r) => r._id.source === source && r._id.outcome === outcome)?.n ?? 0;

  const answered = outcomeCount("chat", "answered");
  const noAnswer = outcomeCount("chat", "no_answer");
  const questions = answered + noAnswer;
  const searches = outcomeCount("search", "results") + outcomeCount("search", "no_results");

  // ---- zero-filled daily series ----
  const perDay = new Map<string, { questions: number; searches: number }>();
  for (const row of seriesAgg) {
    const entry = perDay.get(row._id.day) ?? { questions: 0, searches: 0 };
    if (row._id.source === "chat") entry.questions += row.n;
    else entry.searches += row.n;
    perDay.set(row._id.day, entry);
  }
  const series = Array.from({ length: days }, (_, i) => {
    const date = dayKey(sinceMs + i * DAY_MS);
    return { date, questions: perDay.get(date)?.questions ?? 0, searches: perDay.get(date)?.searches ?? 0 };
  });

  res.status(200).json({
    success: true,
    windowDays: days,
    since: since.toISOString(),
    generatedAt: new Date().toISOString(),
    totals: {
      users: userCount,
      admins: adminCount,
      publishedResources: published,
      draftResources: drafts,
      chunks: chunkCount,
      conversations: conversationCount,
      messages: messageAgg[0]?.total ?? 0,
      savedResources: savedCount,
      deadlines: deadlineCount,
    },
    usage: {
      questions,
      searches,
      answered,
      noAnswer,
      answerRate: questions ? round(answered / questions, 3) : null,
      activeUsers: activeUserIds.length,
      newUsers,
    },
    series,
    topQueries: topQueriesAgg.map((r) => ({
      query: r.sample as string,
      count: r.count as number,
      lastAsked: r.lastAsked as Date,
      avgScore: typeof r.avgScore === "number" ? round(r.avgScore, 2) : null,
      answeredRate: r.count ? round(r.answered / r.count, 2) : 0,
    })),
    topCategories: topCategoriesAgg.map((r) => ({ category: r._id as string, count: r.count as number })),
    unanswered: unansweredAgg.map((r) => ({
      query: r.sample as string,
      count: r.count as number,
      lastAsked: r.lastAsked as Date,
      bestScore: typeof r.bestScore === "number" ? round(r.bestScore, 2) : null,
    })),
  });
});
