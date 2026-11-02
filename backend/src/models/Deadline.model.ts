import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * The "saved information / deadlines" widget from the original spec:
 * a user's own reminders, e.g. "Health insurance enrollment closes".
 *
 * `dueDate` is a calendar DATE, not a moment in time. The client sends
 * "YYYY-MM-DD", which JavaScript stores as midnight UTC - and the frontend
 * reads it back using UTC too (see frontend/src/lib/dates.ts). Mixing UTC
 * storage with local-time display is the classic bug that makes a deadline
 * for "Sept 20" show up as "Sept 19" for anyone west of Greenwich.
 */
export interface IDeadline extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  dueDate: Date;
  note?: string;
  resource?: mongoose.Types.ObjectId;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deadlineSchema = new Schema<IDeadline>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    dueDate: { type: Date, required: [true, "Due date is required"] },
    note: { type: String, trim: true, maxlength: [500, "Note cannot exceed 500 characters"] },
    // Optional link back to the resource this deadline came from.
    resource: { type: Schema.Types.ObjectId, ref: "Resource" },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves "this user's deadlines, soonest first".
deadlineSchema.index({ user: 1, dueDate: 1 });

const Deadline: Model<IDeadline> = mongoose.model<IDeadline>("Deadline", deadlineSchema);

export default Deadline;