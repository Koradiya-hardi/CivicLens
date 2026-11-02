const SNIPPET_MAX_LENGTH = 160;

/**
 * Shortens a chunk of text to a one-or-two-line excerpt for display
 * (citations in chat, matched passages in search results).
 */
export const buildSnippet = (text: string, maxLength: number = SNIPPET_MAX_LENGTH): string => {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}...` : trimmed;
};