import { renderNoteMarkdownToHtml } from "@/lib/noteFormatting";
import { cn } from "@/lib/utils";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function FormattedNoteContent({
  markdown,
  className,
  interactiveLinks = true,
}: {
  markdown: string;
  className?: string;
  interactiveLinks?: boolean;
}) {
  const html = renderNoteMarkdownToHtml(markdown);
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest("a");
    if (!anchor) return;

    if (!interactiveLinks) {
      event.preventDefault();
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;

    event.preventDefault();
    event.stopPropagation();
    navigate(href);
  }

  return (
    <div
      className={cn("journal-markdown space-y-2 whitespace-normal", className)}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
