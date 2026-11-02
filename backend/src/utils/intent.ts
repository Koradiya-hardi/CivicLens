/**
 * Decides, BEFORE any search or LLM call, whether a message is casual
 * conversation ("hi", "how are you?", "thanks", "what can you do?") or a
 * real question that should go through the document-grounded RAG pipeline.
 *
 * Why this exists: the RAG pipeline is deliberately strict - it only answers
 * from retrieved documents and refuses when nothing relevant is found. That
 * is exactly right for "what do I need for a license?" and exactly wrong for
 * "how are you?", which no document will ever contain. Without a router,
 * every greeting hit the "couldn't find enough information" fallback.
 *
 * Why rules and not an LLM classifier: it's free, instant, deterministic,
 * and never eats into the free-tier API quota. The patterns are anchored
 * (^...$) so the WHOLE message must be small talk. That is what keeps
 * "hi, what documents do I need for a license?" going to the real pipeline:
 * it starts with a greeting but isn't only a greeting.
 *
 * Trade-off: unusual phrasings fall through to the normal pipeline, which
 * is the safe default (worst case: an odd greeting gets the polite
 * "couldn't find enough information" reply, as before).
 */
export type Intent = "smalltalk" | "civic";

const FILLER = "(?:there|friend|buddy|bot|civiclens|assistant|ai|man|dude|mate)";
const GREET =
  "(?:hi+|hello+|hey+|heya|hiya|yo|hola|howdy|namaste|sup|good (?:morning|afternoon|evening|night)|greetings)";
const WELLBEING =
  "(?:how(?:re| are| r) (?:you|u)(?: (?:doing|going|feeling))?|how(?:s| is) it going|how do you do|how you doing|how have you been|how(?:s| is) your day(?: going)?|whats up|what is up|wassup)";
const ACTIVITY = "(?:what(?:re| are) you (?:doing|up to)(?: (?:now|right now))?|what you doing|wyd)";
const IDENTITY =
  "(?:who are you|what are you|what is your name|whats your name|what should i call you|who (?:made|built|created|developed) you|are you (?:an? )?(?:ai|bot|robot|human|real|person|chatgpt|gemini|claude)|what can you (?:do|help(?: me)? with)|what do you do|how can you help(?: me)?|how do you work|what is civiclens|what does civiclens do|can you help me|i need help|help me|help)";
const THANKS =
  "(?:thanks|thank you|thank you so much|thanks a lot|thanks so much|thx|ty|cheers|appreciate it|much appreciated)";
const BYE = "(?:bye|goodbye|see you|see ya|cya|good night|talk to you later|ttyl|have a good one)";
const ACK =
  "(?:ok|okay|cool|nice|great|awesome|got it|alright|sounds good|perfect|makes sense|i see|understood)";

const SMALL_TALK_PATTERNS: RegExp[] = [
  // "hi", "hello there"
  new RegExp(`^${GREET}(?: ${FILLER})?$`),
  // "how are you", "hi, how are you doing today"
  new RegExp(`^(?:${GREET}(?: ${FILLER})? )?${WELLBEING}(?: today| now)?(?: ${FILLER})?$`),
  // "what are you doing"
  new RegExp(`^(?:${GREET}(?: ${FILLER})? )?${ACTIVITY}(?: ${FILLER})?$`),
  // "who are you", "what can you do", "help"
  new RegExp(`^(?:${GREET}(?: ${FILLER})? )?${IDENTITY}(?: ${FILLER})?$`),
  // "thanks", "ok thanks for the help"
  new RegExp(
    `^(?:(?:ok|okay|great|cool|awesome|perfect|nice|got it) )?${THANKS}(?: ${FILLER})?(?: for (?:the )?(?:help|info|answer|that))?$`
  ),
  // "bye", "good night"
  new RegExp(`^${BYE}(?: ${FILLER})?$`),
  // "ok", "got it"
  new RegExp(`^${ACK}(?: ${FILLER})?$`),
];

const normalize = (message: string): string =>
  message
    .toLowerCase()
    .replace(/['\u2019]/g, "") // "what's" -> "whats", "how're" -> "howre"
    .replace(/[^a-z0-9 ]/g, " ") // drop punctuation / emoji
    .replace(/\s+/g, " ")
    .trim();

export const detectIntent = (message: string): Intent => {
  const text = normalize(message);

  // Small talk is short by nature. A long message is never small talk,
  // however it starts.
  if (!text || text.split(" ").length > 12) return "civic";

  return SMALL_TALK_PATTERNS.some((pattern) => pattern.test(text)) ? "smalltalk" : "civic";
};