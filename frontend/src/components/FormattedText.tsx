import { parseBlocks, splitBold } from "@/lib/formatText";

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-ink">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

/** Renders an assistant answer with its paragraphs, lists and bold intact. */
export function FormattedText({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-faint">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-ink-faint">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}