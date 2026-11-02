/**
 * Turns the plain text a language model returns into simple blocks the UI
 * can render: paragraphs, bullet lists and numbered lists.
 *
 * Why this exists: Gemini answers with newlines and "* item" bullet lists.
 * Dropped straight into a <div>, HTML collapses all of that into one
 * run-on line full of stray asterisks. This restores the structure
 * WITHOUT a markdown library and WITHOUT dangerouslySetInnerHTML - the
 * output is data, and React escapes every string, so model output can
 * never inject markup into the page.
 */
export type TextBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const BULLET = /^\s*[*\-\u2022]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export const parseBlocks = (text: string): TextBlock[] => {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  const pushListItem = (type: "ul" | "ol", item: string) => {
    flushParagraph();
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) last.items.push(item);
    else blocks.push({ type, items: [item] });
  };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);

    if (bullet) pushListItem("ul", bullet[1]);
    else if (numbered) pushListItem("ol", numbered[1]);
    else paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
};

/** Splits a line into plain and **bold** segments. */
export const splitBold = (text: string): { text: string; bold: boolean }[] =>
  text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.length > 4 && part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false }
    );