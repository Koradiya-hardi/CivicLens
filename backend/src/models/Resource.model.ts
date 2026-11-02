import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A "Resource" is one piece of civic information in the system - could be
 * a DMV requirements guide, a student handbook section, a housing policy,
 * etc. Right now `content` just holds plain text. Starting Week 2, this is
 * exactly the field we'll chunk and embed for the RAG pipeline - so the
 * shape we choose now matters later, not just today.
 */
export interface IResource extends Document {
  title: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdBy: mongoose.Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<IResource>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      // A fixed list keeps the frontend's filter dropdown predictable.
      // Add new categories here as the project grows.
      enum: [
        "Transportation",
        "Housing",
        "Student Services",
        "Financial Aid",
        "Healthcare",
        "Immigration",
        "Taxes",
        "Other",
      ],
    },
    description: {
      type: String,
      required: [true, "A short description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      // No maxlength here on purpose - this can be a full handbook section.
    },
    tags: {
      type: [String],
      default: [],
      // Lowercased on save (see pre-save hook below) so search/filtering
      // by tag doesn't get tripped up by "DMV" vs "dmv".
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    // These four fields are populated only when an admin attached an
    // uploaded document (via POST /api/uploads) rather than typing content
    // in by hand. All optional - a Resource can exist as pure typed text
    // with no file attached at all.
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // lets us .populate("createdBy") to get the admin's name/email later
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      // Lets an admin save a draft (false) before making it publicly visible.
    },
  },
  {
    timestamps: true,
  }
);

// Normalize tags to lowercase, trimmed strings before saving.
resourceSchema.pre("save", function () {
  if (this.isModified("tags")) {
    this.tags = this.tags.map((tag) => tag.toLowerCase().trim());
  }
});

/**
 * Text index on title/description/content - enables MongoDB's built-in
 * `$text` search (keyword search) so /api/resources?search=... works
 * without needing the AI/vector pipeline at all. This is the "Smart Search"
 * feature's first, simple version - Week 2 replaces/augments it with
 * semantic vector search, but keyword search remains a fast fallback.
 */
resourceSchema.index({ title: "text", description: "text", content: "text" });

const Resource: Model<IResource> = mongoose.model<IResource>(
  "Resource",
  resourceSchema
);

export default Resource;