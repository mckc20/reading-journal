import { renderNoteMarkdownToHtml } from "@/lib/noteFormatting";
import { cn } from "@/lib/utils";

export default function FormattedNoteContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const html = renderNoteMarkdownToHtml(markdown);

  return (
    <div
      className={cn("journal-markdown space-y-2 whitespace-normal", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
