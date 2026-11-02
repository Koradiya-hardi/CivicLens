import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useChatStream, type ClosestTopic, type Source } from "@/hooks/useChatStream";
import type { ConversationSummary } from "@/lib/types";
import { FormattedText } from "@/components/FormattedText";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  /** Only set when the assistant couldn't answer: nearby documents to try instead. */
  closestTopics?: ClosestTopic[];
}

export default function ChatPage() {
  const { ask, isStreaming } = useChatStream();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // The assistant's answer as it streams in, piece by piece - kept
  // separate from `messages` until the stream finishes, at which point
  // it gets folded into messages as one complete entry (see onDone below).
  const [streamingText, setStreamingText] = useState("");

  const threadEndRef = useRef<HTMLDivElement>(null);
  // Mirrors streamingText synchronously (state updates are async/batched,
  // so by the time onDone fires we can't trust reading `streamingText`
  // directly - this ref always has the up-to-date accumulated text).
  const liveTextRef = useRef("");

  const loadConversations = async () => {
    try {
      const res = await api.get("/chat/conversations");
      setConversations(res.data.conversations);
    } catch {
      /* the sidebar is a convenience - the chat still works without it */
    }
  };

  const openConversation = async (id: string) => {
    setNotice(null);
    try {
      const res = await api.get(`/chat/conversations/${id}`);
      setActiveConversationId(id);
      setMessages(
        res.data.conversation.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
        }))
      );
    } catch {
      setNotice("Couldn't open that conversation. It may have been deleted.");
    }
  };

  useEffect(() => {
    loadConversations();

    // Deep links from other pages:
    //   /chat?c=<conversationId>  reopens a conversation (dashboard)
    //   /chat?q=<text>            pre-fills the input (library: "Ask about this")
    const conversationId = searchParams.get("c");
    const prefill = searchParams.get("q");
    if (conversationId) openConversation(conversationId);
    if (prefill) setInput(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isStreaming]);

  const startNewConversation = () => {
    setActiveConversationId(undefined);
    setMessages([]);
    setStreamingText("");
    liveTextRef.current = "";
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput("");
    setNotice(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    liveTextRef.current = "";
    setStreamingText("");

    await ask(question, activeConversationId, {
      onMeta: (conversationId) => {
        // First question in a brand-new conversation - now we know its id,
        // so follow-up questions in this same session attach to it.
        if (!activeConversationId) setActiveConversationId(conversationId);
      },
      onChunk: (piece) => {
        liveTextRef.current += piece;
        setStreamingText(liveTextRef.current);
      },
      onDone: ({ sources, closestTopics }) => {
        // Copy the text out BEFORE clearing the ref: React runs the
        // setMessages updater later, so reading liveTextRef.current inside
        // it would see the already-cleared "" and save an empty reply.
        const finalText = liveTextRef.current;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: finalText,
            sources,
            closestTopics: closestTopics?.length ? closestTopics : undefined,
          },
        ]);
        liveTextRef.current = "";
        setStreamingText("");
        loadConversations(); // refresh sidebar - title/order may have changed
      },
      onError: (message) => {
        // If part of an answer already arrived, keep it rather than
        // throwing away text the user was reading.
        const partial = liveTextRef.current;
        setMessages((prev) => [
          ...prev,
          ...(partial ? [{ role: "assistant" as const, content: partial }] : []),
          { role: "assistant" as const, content: `⚠️ ${message}` },
        ]);
        liveTextRef.current = "";
        setStreamingText("");
      },
    });
  };

  const waitingForFirstToken = isStreaming && !streamingText;

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-border bg-surface p-3">
        <button
          onClick={startNewConversation}
          className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-bg transition-transform hover:-translate-y-0.5"
        >
          + New conversation
        </button>
        <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          Recent
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                activeConversationId === c.id
                  ? "bg-accent/15 font-semibold text-ink"
                  : "text-ink-soft hover:bg-surface-2"
              }`}
            >
              {c.title}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-2 text-xs text-ink-faint">No conversations yet.</p>
          )}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex flex-col bg-bg">
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {notice && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {notice}
            </div>
          )}

          {messages.length === 0 && !streamingText && !isStreaming && !notice && (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-faint">
              Say hi, or ask about a public service or policy to get started.
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} {...m} />
          ))}

          {/* The in-progress streamed answer, shown live before it's finalized */}
          {streamingText && <MessageBubble role="assistant" content={streamingText} />}

          {/* Retrieval + generation take a moment before the first word arrives */}
          {waitingForFirstToken && <ThinkingBubble />}

          <div ref={threadEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2.5 border-t border-border p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message"
            placeholder="Ask about a public service or policy…"
            disabled={isStreaming}
            className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-lg bg-accent px-5 text-sm font-bold text-bg disabled:opacity-40"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, sources, closestTopics }: Message) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[72%]" : "max-w-[78%]"}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "whitespace-pre-wrap rounded-br-md bg-gradient-to-br from-accent to-[#7C5CFF] font-medium text-bg"
              : "rounded-bl-md border border-border bg-surface-2 text-ink"
          }`}
        >
          {isUser ? content : <FormattedText text={content} />}
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Sources">
            {sources.map((s) => (
              <div
                key={s.resourceId}
                title={s.snippet}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink-soft"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
                {s.title} · {s.category}
              </div>
            ))}
          </div>
        )}

        {closestTopics && closestTopics.length > 0 && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-xs text-ink-faint">Closest documents in the library:</p>
            <div className="flex flex-wrap gap-2">
              {closestTopics.map((t) => (
                <Link
                  key={t.title}
                  to={`/library?q=${encodeURIComponent(t.title)}`}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-ink"
                >
                  {t.title} · {t.category}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start" role="status" aria-label="CivicLens is thinking">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-surface-2 px-4 py-3.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:300ms]" />
      </div>
    </div>
  );
}