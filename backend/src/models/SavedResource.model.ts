import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A bookmark: "this user saved this resource". Kept as its own small
 * collection (rather than an array of ids on the User document) so that:
 *  - the User document stays small and never grows with usage,
 *  - we can sort/paginate saved items independently,
 *  - the unique index below makes "save the same resource twice" impossible
 *    at the database level, not just in application code.
 */
export interface ISavedResource extends Document {
  user: mongoose.Types.ObjectId;
  resource: mongoose.Types.ObjectId;
  createdAt: Date;
}

const savedResourceSchema = new Schema<ISavedResource>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resource: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One bookmark per user per resource. Also serves the "all saved items for
// this user" query, since `user` is the first key of the index.
savedResourceSchema.index({ user: 1, resource: 1 }, { unique: true });

const SavedResource: Model<ISavedResource> = mongoose.model<ISavedResource>(
  "SavedResource",
  savedResourceSchema
);

export default SavedResource;