import Chunk from "../models/Chunk.model";
import Resource from "../models/Resource.model";
import { generateEmbedding } from "./embedding.service";

/**
 * The name of the Atlas Vector Search index. THIS MUST EXACTLY MATCH the
 * name you give the index when you create it manually in the Atlas UI
 * (Atlas can't create this kind of index through Mongoose/application
 * code - it's configured separately, see the setup instructions).
 * Configurable via env var in case you ever need to point at a
 * differently-named index without changing code.
 */
export const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME || "vector_index";

export interface SearchResult {
  chunkId: string;
  resourceId: string;
  resourceTitle: string;
  resourceDescription: string;
  category: string;
  text: string;
  chunkIndex: number;
  score: number;
}

/**
 * The actual semantic search: given a plain-English query, find the
 * chunks whose MEANING is closest to it - not whose exact words match.
 *
 * How it works:
 * 1. Embed the query the exact same way we embedded every stored chunk
 *    (same model - this matters, mixing embedding models produces
 *    meaningless comparisons).
 * 2. Ask Atlas's $vectorSearch to find the chunks whose vectors are
 *    closest to the query's vector (by cosine similarity, configured in
 *    the index definition).
 * 3. $vectorSearch only gives us chunk data - it doesn't know about our
 *    Resource collection at all, so we do a second, ordinary query to
 *    fetch each matching chunk's parent Resource (for its title/category,
 *    which is what lets us actually cite a source in the final answer).
 */
export const semanticSearch = async (
  query: string,
  topK: number = 5
): Promise<SearchResult[]> => {
  const queryEmbedding = await generateEmbedding(query);

  const rawResults = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: queryEmbedding,
        // numCandidates: how many candidate vectors Atlas scans BEFORE
        // narrowing down to `limit`. Higher = more accurate but slower.
        // 20x the number of results we actually want is a commonly
        // recommended starting ratio.
        numCandidates: Math.max(topK * 20, 100),
        limit: topK,
      },
    },
    {
      $project: {
        text: 1,
        chunkIndex: 1,
        resource: 1,
        // $vectorSearch doesn't include its similarity score in the
        // output by default - $meta: "vectorSearchScore" is how you pull
        // it out. This is what Day 5's confidence check relies on.
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  if (rawResults.length === 0) return [];

  // One batched lookup for all the parent Resources these chunks belong
  // to, rather than N separate queries (one per chunk) - same batching
  // principle as everywhere else in this project.
  const resourceIds = [...new Set(rawResults.map((r) => String(r.resource)))];
  const resources = await Resource.find({ _id: { $in: resourceIds } }).select(
    "title category description isPublished"
  );
  const resourceMap = new Map(resources.map((r) => [String(r._id), r]));

  // Skip chunks whose parent Resource is gone (deleted - chunks are not
  // cascade-deleted) or unpublished (a draft). Without this, a draft's text
  // could be quoted to users, and deleted documents would show up as
  // "Unknown resource".
  return rawResults.flatMap((r) => {
    const resource = resourceMap.get(String(r.resource));
    if (!resource || !resource.isPublished) return [];

    return [
      {
        chunkId: String(r._id),
        resourceId: String(r.resource),
        resourceTitle: resource.title,
        resourceDescription: resource.description,
        category: resource.category,
        text: r.text as string,
        chunkIndex: r.chunkIndex as number,
        score: r.score as number,
      },
    ];
  });
};
