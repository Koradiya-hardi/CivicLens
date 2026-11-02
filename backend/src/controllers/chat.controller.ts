import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation, { IConversation, IMessage } from "../models/Conversation.model";
import { semanticSearch, SearchResult } from "../services/vectorSearch.service";
import {
  generateAnswer,
  streamAnswer,
  generateSmallTalk,
  streamSmallTalk,
  ChatTurn,
} from "../services/llm.service";
import { detectIntent } from "../utils/intent";
import { logQuery, describeResults } from "../services/queryLog.service";
import { buildSnippet } from "../utils/snippet";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";

const TOP_K = 5;
const MIN_CONFIDENCE_SCORE = 0.65;
const HISTORY_WINDOW_SIZE = 6;

// Friendlier than before: it now also tells the user what the assistant IS
// for, so a question outside its scope (general trivia, say) gets a useful
// nudge instead of a dead end.
const NOT_ENOUGH_INFO_MESSAGE =
  "I couldn't find enough information in the available sources to answer that reliably. " +
  "I can help with public services and policies covered by the documents added to CivicLens - " +
  "try asking about a specific service, form, or policy.";

// Used only if the small-talk model call itself fails (rate limit, outage):
// a greeting should never turn into an error message.
const SMALL_TALK_FALLBACK =
  "Hi! I'm CivicLens. I help explain public services, policies, and official documents in plain language. What would you like to know?";

const DEFAULT_TITLE = "New conversation";

const buildSearchQuery = (question: string, recentMessages: IMessage[]): string => {
  // Skip earlier small talk ("thanks") when looking for the previous
  // question to borrow context from - it would only dilute the search.
  const lastRealQuestion = [...recentMessages]
    .reverse()
    .find((m) => m.role === "user" && detectIntent(m.content) === "civic");
  return lastRealQuestion ? `${lastRealQuestion.content} ${question}` : question;
};

const buildConversationTitle = (firstQuestion: string): string => {
  const trimmed = firstQuestion.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
};

/**
 * Citation formatting (Week 3): de-duplicate by resource, number them, and
 * attach a short excerpt of the text that grounded the answer.
 */
interface FormattedSource {
  index: number;
  resourceId: string;
  title: string;
  category: string;
  snippet: string;
}

const formatSources = (results: SearchResult[]): FormattedSource[] => {
  const byResource = new Map<string, FormattedSource>();

  for (const r of results) {
    if (!byResource.has(r.resourceId)) {
      byResource.set(r.resourceId, {
        index: byResource.size + 1,
        resourceId: r.resourceId,
        title: r.resourceTitle,
        category: r.category,
        snippet: buildSnippet(r.text),
      });
    }
  }

  return Array.from(byResource.values());
};

/**
 * WEEK 5 CHANGE: this used to also run the vector search. It now ONLY loads
 * (or creates) the conversation, because small talk must skip retrieval
 * completely - no embedding, no database vector search, no wasted time.
 * Retrieval moved to `retrieve()` below and is called only for real questions.
 */
const loadConversation = async (
  userId: mongoose.Types.ObjectId,
  question: string,
  conversationId: string | undefined,
  isSmallTalk: boolean
): Promise<{ conversation: IConversation; recentMessages: IMessage[] }> => {
  let conversation: IConversation;

  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError("Invalid conversationId", 400);
    }

    const found = await Conversation.findById(conversationId);
    if (!found) {
      throw new AppError("Conversation not found", 404);
    }
    if (String(found.user) !== String(userId)) {
      throw new AppError("Not authorized to access this conversation", 403);
    }
    conversation = found;

    // A chat that opened with "hi" is titled "New conversation"; give it a
    // real title the first time an actual question arrives.
    if (!isSmallTalk && conversation.title === DEFAULT_TITLE) {
      conversation.title = buildConversationTitle(question);
    }
  } else {
    conversation = await Conversation.create({
      user: userId,
      // Titling a chat "hi" would make the sidebar useless.
      title: isSmallTalk ? DEFAULT_TITLE : buildConversationTitle(question),
      messages: [],
    });
  }

  return { conversation, recentMessages: conversation.messages.slice(-HISTORY_WINDOW_SIZE) };
};

const retrieve = (question: string, recentMessages: IMessage[]) =>
  semanticSearch(buildSearchQuery(question, recentMessages), TOP_K);

const toHistory = (messages: IMessage[]): ChatTurn[] =>
  messages.map((m) => ({ role: m.role, content: m.content }));

const toSourceDocs = (sources: FormattedSource[]) =>
  sources.map((s) => ({
    resourceId: new mongoose.Types.ObjectId(s.resourceId),
    title: s.title,
    category: s.category,
    snippet: s.snippet,
  }));

/** Small-talk reply with a safety net - never surfaces an error for "hi". */
const smallTalkReply = async (question: string, history: ChatTurn[]): Promise<string> => {
  try {
    const reply = await generateSmallTalk(question, history);
    return reply.trim() || SMALL_TALK_FALLBACK;
  } catch {
    return SMALL_TALK_FALLBACK;
  }
};

/**
 * POST /api/chat/ask
 * Non-streaming. Body: { question, conversationId? }
 *
 * Flow: classify intent -> (small talk: reply, done) or (civic question:
 * retrieve -> confidence gate -> grounded answer with sources).
 * Every response now carries `kind`: "smalltalk" | "answer" | "no_answer".
 */
export const askQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { question, conversationId } = req.body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    throw new AppError("question is required", 400);
  }

  const intent = detectIntent(question);
  const { conversation, recentMessages } = await loadConversation(
    req.user!._id as mongoose.Types.ObjectId,
    question,
    conversationId,
    intent === "smalltalk"
  );

  conversation.messages.push({ role: "user", content: question, createdAt: new Date() });

  // ---- Casual message: no retrieval, no sources ----
  if (intent === "smalltalk") {
    const answer = await smallTalkReply(question, toHistory(recentMessages));

    conversation.messages.push({ role: "assistant", content: answer, createdAt: new Date() });
    await conversation.save();

    return res.status(200).json({
      success: true,
      conversationId: conversation._id,
      question,
      answer,
      kind: "smalltalk",
      confident: true,
      sources: [],
    });
  }

  // ---- Real question: the grounded RAG path ----
  const results = await retrieve(question, recentMessages);

  if (results.length === 0 || results[0].score < MIN_CONFIDENCE_SCORE) {
    conversation.messages.push({
      role: "assistant",
      content: NOT_ENOUGH_INFO_MESSAGE,
      createdAt: new Date(),
    });
    await conversation.save();

    // Admin analytics: remember what could NOT be answered (the content gaps).
    // Deliberately not awaited - logging must never delay or break the reply.
    logQuery({
      source: "chat",
      user: req.user!._id as mongoose.Types.ObjectId,
      query: question,
      outcome: "no_answer",
      resultCount: results.length,
      topScore: describeResults(results).topScore,
    });

    return res.status(200).json({
      success: true,
      conversationId: conversation._id,
      question,
      answer: NOT_ENOUGH_INFO_MESSAGE,
      kind: "no_answer",
      confident: false,
      sources: [],
      closestTopics: results.slice(0, 3).map((r) => ({
        title: r.resourceTitle,
        category: r.category,
      })),
    });
  }

  const answer = await generateAnswer(
    question,
    results.map((r) => ({ text: r.text, resourceTitle: r.resourceTitle })),
    toHistory(recentMessages)
  );

  const sources = formatSources(results);

  conversation.messages.push({
    role: "assistant",
    content: answer,
    sources: toSourceDocs(sources),
    createdAt: new Date(),
  });
  await conversation.save();

  logQuery({
    source: "chat",
    user: req.user!._id as mongoose.Types.ObjectId,
    query: question,
    outcome: "answered",
    ...describeResults(results),
  });

  res.status(200).json({
    success: true,
    conversationId: conversation._id,
    question,
    answer,
    kind: "answer",
    confident: true,
    sources,
  });
});

/**
 * POST /api/chat/ask/stream
 * Same flow as askQuestion, delivered as Server-Sent Events:
 *   {type:"meta", conversationId} -> {type:"chunk", text}* -> {type:"done", ...}
 * The `done` event now also carries `kind`.
 */
export const askQuestionStream = asyncHandler(async (req: Request, res: Response) => {
  const { question, conversationId } = req.body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    throw new AppError("question is required", 400);
  }

  const intent = detectIntent(question);
  const { conversation, recentMessages } = await loadConversation(
    req.user!._id as mongoose.Types.ObjectId,
    question,
    conversationId,
    intent === "smalltalk"
  );

  conversation.messages.push({ role: "user", content: question, createdAt: new Date() });

  // For a real question we retrieve BEFORE opening the stream, so a failure
  // here still produces a normal JSON error response instead of a broken stream.
  const results = intent === "civic" ? await retrieve(question, recentMessages) : [];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  send({ type: "meta", conversationId: conversation._id });

  // ---- Casual message ----
  if (intent === "smalltalk") {
    // Accumulated as pieces are sent, so if the model fails midway we know
    // exactly what the user has already seen (the awaited return value is
    // lost when the call throws).
    let reply = "";
    try {
      await streamSmallTalk(question, toHistory(recentMessages), (piece) => {
        reply += piece;
        send({ type: "chunk", text: piece });
      });
    } catch {
      // Keep whatever already reached the user. Only if NOTHING was sent
      // do we fall back to a canned greeting - never glue one onto a
      // half-finished reply.
    }
    if (!reply.trim()) {
      reply = SMALL_TALK_FALLBACK;
      send({ type: "chunk", text: reply });
    }

    conversation.messages.push({ role: "assistant", content: reply, createdAt: new Date() });
    await conversation.save();

    send({ type: "done", kind: "smalltalk", confident: true, sources: [] });
    return res.end();
  }

  // ---- Real question, but nothing relevant found ----
  if (results.length === 0 || results[0].score < MIN_CONFIDENCE_SCORE) {
    conversation.messages.push({
      role: "assistant",
      content: NOT_ENOUGH_INFO_MESSAGE,
      createdAt: new Date(),
    });
    await conversation.save();

    logQuery({
      source: "chat",
      user: req.user!._id as mongoose.Types.ObjectId,
      query: question,
      outcome: "no_answer",
      resultCount: results.length,
      topScore: describeResults(results).topScore,
    });

    send({ type: "chunk", text: NOT_ENOUGH_INFO_MESSAGE });
    send({
      type: "done",
      kind: "no_answer",
      confident: false,
      sources: [],
      closestTopics: results.slice(0, 3).map((r) => ({
        title: r.resourceTitle,
        category: r.category,
      })),
    });
    return res.end();
  }

  // ---- Real question, grounded answer ----
  let fullAnswer = "";
  try {
    fullAnswer = await streamAnswer(
      question,
      results.map((r) => ({ text: r.text, resourceTitle: r.resourceTitle })),
      toHistory(recentMessages),
      (piece) => send({ type: "chunk", text: piece })
    );
  } catch {
    send({ type: "error", message: "Failed to generate an answer. Please try again." });
    return res.end();
  }

  const sources = formatSources(results);

  conversation.messages.push({
    role: "assistant",
    content: fullAnswer,
    sources: toSourceDocs(sources),
    createdAt: new Date(),
  });
  await conversation.save();

  logQuery({
    source: "chat",
    user: req.user!._id as mongoose.Types.ObjectId,
    query: question,
    outcome: "answered",
    ...describeResults(results),
  });

  send({ type: "done", kind: "answer", confident: true, sources });
  res.end();
});

/**
 * GET /api/chat/conversations
 */
export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await Conversation.find({ user: req.user!._id })
    .select("title createdAt updatedAt messages")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: conversations.length,
    conversations: conversations.map((c) => ({
      id: c._id,
      title: c.title,
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
});

/**
 * GET /api/chat/conversations/:id
 */
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;

  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid conversation id", 400);
  }

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  if (String(conversation.user) !== String(req.user!._id)) {
    throw new AppError("Not authorized to access this conversation", 403);
  }

  res.status(200).json({
    success: true,
    conversation,
  });
});
