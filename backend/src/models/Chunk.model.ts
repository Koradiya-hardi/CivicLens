import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * A Resource holds the FULL content of a document. A Chunk holds one small
 * piece of that content, plus the embedding vector for that piece.
 *
 * Why a separate collection instead of embedding fields living on Resource
 * itself? A Resource's content might be one paragraph or twenty pages -
 * chunked into anywhere from 1 to hundreds of pieces. Mongoose/MongoDB
 * documents aren't a great fit for "one parent, many-to-many-sized list of
 * large sub-objects, each independently searched" - a separate collection
 * with a reference back to its parent Resource is the standard pattern,
 * and it's exactly what next session's $vectorSearch query will search
 * directly (searching Chunks, then following `.resource` back to know
 * which Resource/page it came from for the citation).
 */
export interface IChunk extends Document {
  resource: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true, // we'll frequently query/delete "all chunks for resource X"
    },
    chunkIndex: {
      type: Number,
      required: true,
      // Preserves original order within the source document - chunk 0 came
      // before chunk 1, etc. Useful for debugging and for showing "page/
      // section order" context later if needed.
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
      // NOTE: this is a plain array field for now. The actual Atlas Vector
      // Search INDEX (the thing that makes searching over these arrays
      // fast) is configured separately in the Atlas UI/Admin API, not in
      // Mongoose - that's next session's job (Day 3). Right now we're just
      // making sure the data itself is being generated and stored correctly.
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const Chunk: Model<IChunk> = mongoose.model<IChunk>("Chunk", chunkSchema);

export default Chunk;