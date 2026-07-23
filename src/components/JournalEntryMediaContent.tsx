import FormattedNoteContent from "@/components/FormattedNoteContent";
import { splitMarkdownIntoJournalBlocks } from "@/lib/journalMedia";
import { cn } from "@/lib/utils";
import type { JournalEntryMediaItem } from "@/types";

interface JournalEntryMediaContentProps {
  markdown: string;
  media?: JournalEntryMediaItem[];
  className?: string;
  mediaClassName?: string;
  imageClassName?: string;
  captionClassName?: string;
  lineClamp?: boolean;
  thumbnail?: boolean;
}

export function JournalMediaFigure({
  item,
  className,
  imageClassName,
  captionClassName,
  thumbnail = false,
}: {
  item: JournalEntryMediaItem;
  className?: string;
  imageClassName?: string;
  captionClassName?: string;
  thumbnail?: boolean;
}) {
  const attachment = item.media_attachment;
  return (
    <div className="my-4 flex w-full justify-start" data-journal-media-figure>
      <figure className={cn("m-0 max-w-full border-l-2 border-primary/30 pl-3 text-left", className)}>
        <img
          src={thumbnail ? item.thumbnailUrl ?? item.url : item.url}
          alt={item.caption?.trim() || attachment.file_name}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          loading="lazy"
          data-journal-media-image
          data-journal-media-thumbnail={thumbnail ? "true" : undefined}
          className={cn("block h-auto max-h-[34rem] max-w-full rounded-md object-contain", imageClassName)}
        />
        {item.caption && (
          <figcaption className={cn("mt-2 text-xs italic leading-5 text-muted-foreground", captionClassName)}>
            {item.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

export default function JournalEntryMediaContent({
  markdown,
  media = [],
  className,
  mediaClassName,
  imageClassName,
  captionClassName,
  lineClamp = false,
  thumbnail = false,
}: JournalEntryMediaContentProps) {
  if (lineClamp) {
    return <FormattedNoteContent markdown={markdown} className={className} />;
  }

  const blocks = splitMarkdownIntoJournalBlocks(markdown, media);

  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block) => (
        <div key={block.key} className="space-y-3">
          {block.markdown.trim() && <FormattedNoteContent markdown={block.markdown} />}
          {block.media.map((item) => (
            <JournalMediaFigure
              key={item.id}
              item={item}
              thumbnail={thumbnail}
              className={mediaClassName}
              imageClassName={imageClassName}
              captionClassName={captionClassName}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
