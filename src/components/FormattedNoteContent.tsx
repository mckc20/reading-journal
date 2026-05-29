import type { ReactNode } from "react";
import QuoteBlock from "@/components/QuoteBlock";
import {
  parseNoteMarkdown,
  type NoteBlockNode,
  type NoteInlineNode,
} from "@/lib/noteFormatting";
import { cn } from "@/lib/utils";

function renderInlineNodes(nodes: NoteInlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === "text") {
      return node.text.split("\n").map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </span>
      ));
    }

    if (node.type === "bold") {
      return <strong key={index}>{renderInlineNodes(node.children)}</strong>;
    }

    return <em key={index}>{renderInlineNodes(node.children)}</em>;
  });
}

function renderNoteBlock(block: NoteBlockNode, index: number): ReactNode {
  if (block.type === "quote") {
    return (
      <QuoteBlock key={index} className="my-3">
        {renderInlineNodes(block.children)}
      </QuoteBlock>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={index} className="list-disc space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInlineNodes(item)}</li>
        ))}
      </ul>
    );
  }

  return <p key={index}>{renderInlineNodes(block.children)}</p>;
}

export default function FormattedNoteContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = parseNoteMarkdown(markdown);

  return (
    <div className={cn("space-y-2 whitespace-normal", className)}>
      {blocks.map(renderNoteBlock)}
    </div>
  );
}
