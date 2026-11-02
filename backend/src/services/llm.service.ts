/**
 * This is the "generate a plain-language answer" half of RAG - separate
 * from embeddings entirely. Embeddings (embedding.service.ts) only measure
 * similarity between text; they can't write a new sentence. This is the
 * piece that actually reads the retrieved chunks + the question and
 * produces a real answer.
 *
 * Uses Google's Gemini API (free tier - see .env.example for how to get
 * a key). @google/genai is Google's current official SDK (the older
 * @google/generative-ai package is deprecated) - and like pdfjs-dist and
 * @xenova/transformers, it's ESM-only, so we use a dynamic import() from
 * this CommonJS project.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientPromise: Promise<any> | null = null;

async function loadClient() {
  // @ts-ignore - ESM-only package; dynamic import is the documented way
  // to use it from a CommonJS/TypeScript project.
  const { GoogleGenAI } = await import("@google/genai");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set - required to generate answers");
  }

  return new GoogleGenAI({ apiKey });
}

function getClient() {
  if (!clientPromise) {
    clientPromise = loadClient();
  }
  return clientPromise;
}


export const GENERATION_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTION = `You are CivicLens, an assistant that explains public services, policies, and official documents in plain, friendly language.

Rules you MUST follow:
- Answer ONLY using the information in the provided context below. Do not use any outside knowledge, even if you know the answer.
- If the context does not contain enough information to answer the question confidently, say so clearly instead of guessing.
- Keep answers concise, plain-language, and avoid legal/bureaucratic jargon where possible.
- Never invent section numbers, page numbers, dates, or facts that are not explicitly present in the context.
- You may use earlier turns in this conversation to understand what the user is referring to (e.g. pronouns like "it" or "this"), but every FACTUAL claim in your answer must still come only from the context provided with the current question.`;

export interface ContextChunk {
  text: string;
  resourceTitle: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}


const buildContents = (
  question: string,
  contextChunks: ContextChunk[],
  history: ChatTurn[]
) => {
  const contextBlock = contextChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.resourceTitle}]\n${chunk.text}`)
    .join("\n\n");

  // Prior turns, translated into Gemini's shape. Note we do NOT re-inject
  // retrieved context into every historical turn - only the CURRENT
  // question gets fresh context attached (see finalTurn below). Past
  // turns are included purely so the model remembers what was already
  // discussed (e.g. "I'm a grad student"), not to re-answer them.
  const historyContents = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  const finalTurn = {
    role: "user",
    parts: [{ text: `Context:\n${contextBlock}\n\nQuestion: ${question}` }],
  };

  return [...historyContents, finalTurn];
};

export const generateAnswer = async (
  question: string,
  contextChunks: ContextChunk[],
  history: ChatTurn[] = []
): Promise<string> => {
  const ai = await getClient();

  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: buildContents(question, contextChunks, history),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  return response.text ?? "";
};

/**
 * ===== STREAMING VERSION =====
 * Same inputs, same system instruction, same model - the only difference
 * is HOW the response arrives: Gemini sends the answer back in small
 * pieces (an AsyncGenerator) instead of one complete block. `onChunk` is
 * called once per piece, as it arrives, so the caller (chat.controller.ts)
 * can forward each piece to the client immediately over Server-Sent Events
 * - that's what makes the answer visibly "type out" instead of appearing
 * all at once after a long pause.
 *
 * We still return the FULL concatenated text at the end, because the
 * conversation needs to save the complete answer to MongoDB regardless of
 * how it was delivered - streaming changes the delivery, not what gets
 * persisted.
 */
export const streamAnswer = async (
  question: string,
  contextChunks: ContextChunk[],
  history: ChatTurn[],
  onChunk: (textPiece: string) => void
): Promise<string> => {
  const ai = await getClient();

  const stream = await ai.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: buildContents(question, contextChunks, history),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  let fullText = "";

  for await (const chunk of stream) {
    const piece = chunk.text ?? "";
    if (piece) {
      fullText += piece;
      onChunk(piece);
    }
  }

  return fullText;
};

/* ======================================================================
 * The RAG answer path above is intentionally strict: documents only. That
 * is the wrong tool for "hi", "how are you?" or "what can you do?", which
 * no document will ever answer. chat.controller.ts routes those messages
 * (see utils/intent.ts) to the functions below instead: same model, but
 * a different job and a different, much looser prompt.
 *
 * The guardrail that matters: the small-talk prompt forbids stating any
 * facts about public services. The model can be warm and conversational,
 * but anything factual still has to come through the grounded, cited path
 * - so friendliness can never become a back door for made-up policy.
 * ====================================================================== */

const SMALL_TALK_INSTRUCTION = `You are CivicLens, a friendly assistant that helps people understand public services, government forms, policies, and official documents in plain language.

The user has sent a casual message (a greeting, a thank-you, a question about you, or similar). Reply the way a warm, helpful person would.

Rules you MUST follow:
- Keep it short: one to three sentences.
- You are an AI assistant. Be honest about that if asked, and keep it light - for example, "how are you?" is fine to answer naturally, but don't claim human experiences, a body, or a personal life.
- Where it fits, mention what you can help with: things like driver's license requirements, school or university policies, housing, financial aid, healthcare enrollment, immigration paperwork, and taxes - explained in plain language and tied back to the official documents that have been added to CivicLens.
- Do NOT state any specific fact, rule, requirement, fee, date, or deadline about any public service. If the user wants that, invite them to ask a specific question so you can look it up in the documents.
- Do not use outside knowledge to answer general-knowledge questions here.
- Use earlier turns only to respond naturally (for example, "you're welcome" after being thanked for an answer).
- Plain text only. No headings, no bullet lists.`;

const historyToContents = (history: ChatTurn[]) =>
  history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

export const generateSmallTalk = async (
  message: string,
  history: ChatTurn[] = []
): Promise<string> => {
  const ai = await getClient();

  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: [...historyToContents(history), { role: "user", parts: [{ text: message }] }],
    config: { systemInstruction: SMALL_TALK_INSTRUCTION },
  });

  return response.text ?? "";
};

/** Streaming twin of generateSmallTalk - same contract as streamAnswer. */
export const streamSmallTalk = async (
  message: string,
  history: ChatTurn[],
  onChunk: (textPiece: string) => void
): Promise<string> => {
  const ai = await getClient();

  const stream = await ai.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: [...historyToContents(history), { role: "user", parts: [{ text: message }] }],
    config: { systemInstruction: SMALL_TALK_INSTRUCTION },
  });

  let fullText = "";
  for await (const chunk of stream) {
    const piece = chunk.text ?? "";
    if (piece) {
      fullText += piece;
      onChunk(piece);
    }
  }
  return fullText;
};
