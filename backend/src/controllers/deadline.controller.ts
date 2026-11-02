import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Deadline from "../models/Deadline.model";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";

/**
 * Every query below filters by `user: req.user._id` in addition to the
 * deadline's own id. That's the ownership check: someone who guesses
 * another user's deadline id simply gets a 404, never their data.
 */

/** GET /api/deadlines - incomplete first, soonest due date first. */
export const listDeadlines = asyncHandler(async (req: Request, res: Response) => {
  const deadlines = await Deadline.find({ user: req.user!._id }).sort({
    completed: 1,
    dueDate: 1,
  });

  res.status(200).json({ success: true, count: deadlines.length, deadlines });
});

/** POST /api/deadlines  body: { title, dueDate: "YYYY-MM-DD", note?, resourceId? } */
export const createDeadline = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { title, dueDate, note, resourceId } = req.body;

  const deadline = await Deadline.create({
    user: req.user!._id,
    title,
    dueDate: new Date(dueDate),
    note: note || undefined,
    resource: resourceId || undefined,
  });

  res.status(201).json({ success: true, deadline });
});

/** PATCH /api/deadlines/:id/toggle - flips completed true/false. */
export const toggleDeadline = asyncHandler(async (req: Request, res: Response) => {
  const deadlineId = req.params.id;
  if (typeof deadlineId !== "string" || !mongoose.Types.ObjectId.isValid(deadlineId)) {
    throw new AppError("Invalid deadline id", 400);
  }

  const deadline = await Deadline.findOne({ _id: deadlineId, user: req.user!._id });
  if (!deadline) {
    throw new AppError("Deadline not found", 404);
  }

  deadline.completed = !deadline.completed;
  await deadline.save();

  res.status(200).json({ success: true, deadline });
});

/** DELETE /api/deadlines/:id */
export const deleteDeadline = asyncHandler(async (req: Request, res: Response) => {
  const deadlineId = req.params.id;
  if (typeof deadlineId !== "string" || !mongoose.Types.ObjectId.isValid(deadlineId)) {
    throw new AppError("Invalid deadline id", 400);
  }

  const result = await Deadline.deleteOne({ _id: deadlineId, user: req.user!._id });
  if (result.deletedCount === 0) {
    throw new AppError("Deadline not found", 404);
  }

  res.status(200).json({ success: true, message: "Deadline deleted" });
});