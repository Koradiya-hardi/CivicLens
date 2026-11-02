import { useCallback, useState } from "react";

export interface Source {
  index: number;
  resourceId: string;
  title: string;
  category: string;
  snippet: string;
}

export interface ClosestTopic {
  title: string;
  category: string;
}

/** What kind of reply the server produced (Week 5 added small talk). */
export type ReplyKind = "smalltalk" | "answer" | "no_answer";

interface StreamEvent {
  type: "meta" | "chunk" | "done" | "error";
  kind?: ReplyKind;
  conversationId?: string;
  text?: string;
  confident?: boolean;
  sources?: Source[];
  closestTopics?: ClosestTopic[];
  message?: string;
}

interface AskHandlers {
  onMeta: (conversationId: string) => void;
  onChunk: (textPiece: string) => void;
  onDone: (payload: {
    kind?: ReplyKind;
    confident: boolean;
    sources: Source[];
    closestTopics?: ClosestTopic[];
  }) => void;
  onError: (message: string) => void;
}

const TOKEN_KEY = "civiclens_token";

/**
 * WHY this can't just use the browser's built-in EventSource API (the
 * "normal" way to consume Server-Sent Events): EventSource only supports
 * GET requests and can't attach custom headers - but our endpoint is a
 * POST (it needs a JSON body: the question + conversationId) AND
 * requires an Authorization header (it's a protected route). So instead
 * we use plain `fetch`, which supports both, and manually read the
 * response body as a stream - decoding and parsing the same
 * `data: {...}\n\n` format ourselves.
 *
 * WEEK 5 FIXES:
 *  - A non-2xx response (rate limit, expired login, server error) arrives
 *    as plain JSON, not as an event stream. The old code read it as a
 *    stream, found no `data:` lines, and silently did nothing. It now
 *    checks `res.ok` first and reports the server's message.
 *  - If the connection drops before a `done`/`error` event, the caller is
 *    told, instead of being left waiting forever.
 */
export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);

  const ask = useCallback(
    async (question: string, conversationId: string | undefined, handlers: AskHandlers) => {
      setIsStreaming(true);

      const token = localStorage.getItem(TOKEN_KEY);
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

      // Set once the server tells us the reply is complete (or failed), so
      // we can tell "finished normally" apart from "connection just dropped".
      let finished = false;

      try {
        const res = await fetch(`${apiUrl}/chat/ask/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ question, conversationId }),
        });

        if (!res.ok) {
          let message = "Something went wrong. Please try again.";
          if (res.status === 429) {
            message = "You're sending messages too quickly. Please wait a moment and try again.";
          } else if (res.status === 401) {
            message = "Your session has expired. Please log in again.";
          } else {
            try {
              const body = await res.json();
              if (typeof body?.message === "string") message = body.message;
            } catch {
              /* body wasn't JSON - keep the generic message */
            }
          }
          throw new Error(message);
        }

        if (!res.body) {
          throw new Error("No response body received from server");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // Chunks of raw bytes can split a single SSE message across two
        // reads - we buffer whatever's left over and only process
        // complete messages (separated by a blank line).
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? ""; // last piece may be incomplete - keep it for next read

          for (const raw of messages) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue; // skip a malformed event rather than abandoning the whole answer
            }

            if (event.type === "meta" && event.conversationId) {
              handlers.onMeta(event.conversationId);
            } else if (event.type === "chunk" && event.text) {
              handlers.onChunk(event.text);
            } else if (event.type === "done") {
              finished = true;
              handlers.onDone({
                kind: event.kind,
                confident: !!event.confident,
                sources: event.sources ?? [],
                closestTopics: event.closestTopics,
              });
            } else if (event.type === "error") {
              finished = true;
              handlers.onError(event.message ?? "Something went wrong");
            }
          }
        }

        if (!finished) {
          handlers.onError("The connection was interrupted before the answer finished.");
        }
      } catch (err) {
        handlers.onError(err instanceof Error ? err.message : "Connection failed");
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  return { ask, isStreaming };
}