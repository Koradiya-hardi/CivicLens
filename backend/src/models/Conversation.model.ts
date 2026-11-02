import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISource {
  resourceId: mongoose.Types.ObjectId;
  title: string;
  category: string;
  // ===== WEEK 3 CITATION FORMATTING UPDATE =====
  // A short excerpt of the actual chunk text that grounded the answer -
  // lets the frontend show WHY a source is cited ("...students may
  // request a leave of absence for one semester...") instead of just a
  // bare title, without needing a second request to fetch the full
  // resource. Optional so older stored conversations (saved before this
  // field existed) don't break anything.
  snippet?: string;
}

export interface IMessage {
  role: "user" | "assistant";
  content: string;
  // Only assistant messages carry sources - a user's own question was
  // never "grounded" in anything, so this stays empty/undefined for
  // role: "user" messages.
  sources?: ISource[];
  createdAt: Date;
}

export interface IConversation extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    snippet: { type: String },
  },
  { _id: false } // sources are simple value objects - no need for their own _id
);

const messageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // we constantly query "all conversations for user X"
    },
    title: {
      type: String,
      required: true,
      // Auto-generated from the first question (see chat.controller.ts) -
      // this is what a "recent conversations" list (Week 5 dashboard)
      // will actually display, since "Conversation #6f8a2b1..." means
      // nothing to a person.
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Conversation: Model<IConversation> = mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
);

export default Conversation;