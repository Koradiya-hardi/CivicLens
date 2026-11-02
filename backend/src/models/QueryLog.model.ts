import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * One row per question asked in chat, or search run in the library.
 * Powers the admin analytics: most-asked questions, busiest topics, and -
 * most usefully - the questions nobody could answer (gaps in the library).
 *
 * Small talk is deliberately NOT logged: "hi" and "thanks" say nothing
 * about what people need, and storing them would just be noise.
 *
 * Privacy: the user id is stored for chat questions, but the admin screens
 * only ever show aggregates. Rows delete themselves after RETENTION_DAYS
 * (MongoDB's TTL index on createdAt), so this is never a permanent record.
 */
export const RETENTION_DAYS = 90;

export type QuerySource = "chat" | "search";
// chat:   answered | no_answer      search: results | no_results
export type QueryOutcome = "answered" | "no_answer" | "results" | "no_results";

export interface IQueryLog extends Document {
  user?: mongoose.Types.ObjectId;
  source: QuerySource;
  query: string;
  normalized: string; // lowercased, punctuation stripped - groups "Leave?" with "leave"
  outcome: QueryOutcome;
  resultCount: number;
  topScore?: number;
  topCategory?: string;
  createdAt: Date;
}

const queryLogSchema = new Schema<IQueryLog>({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  source: { type: String, enum: ["chat", "search"], required: true },
  query: { type: String, required: true, maxlength: 300 },
  normalized: { type: String, required: true, maxlength: 200 },
  outcome: {
    type: String,
    enum: ["answered", "no_answer", "results", "no_results"],
    required: true,
  },
  resultCount: { type: Number, default: 0 },
  topScore: { type: Number },
  topCategory: { type: String },
  // `expires` makes MongoDB delete the row automatically after this long.
  createdAt: { type: Date, default: Date.now, expires: RETENTION_DAYS * 24 * 60 * 60 },
});

const QueryLog: Model<IQueryLog> = mongoose.model<IQueryLog>("QueryLog", queryLogSchema);

export default QueryLog;
