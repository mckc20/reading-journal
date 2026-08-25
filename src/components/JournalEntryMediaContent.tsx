import FormattedNoteContent from "@/components/FormattedNoteContent";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sortJournalMedia } from "@/lib/journalMedia";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { JournalEntryMediaItem } from "@/types";

interface JournalEntryMediaContentProps {
  markdown: string;
  media?: JournalEntryMediaItem[];
  className?: string;
  mediaGridClassName?: string;
  mediaClassName?: string;
  imageClassName?: string;
  captionClassName?: string;
  lineClamp?: boolean;
  thumbnail?: boolean;
  visibleMediaLimit?: number;
  interactiveLinks?: boolean;
}

export function JournalMediaFigure({
  item,
  className,
  imageClassName,
  captionClassName,
  thumbnail = false,
  onClick,
}: {
  item: JournalEntryMediaItem;
  className?: string;
  imageClassName?: string;
  captionClassName?: string;
  thumbnail?: boolean;
  onClick?: () => void;
}) {
  const attachment = item.media_attachment;
  const image = (
    <img
      src={thumbnail ? item.thumbnailUrl ?? item.url : item.url}
      alt={item.caption?.trim() || attachment.file_name}
      width={attachment.width ?? undefined}
      height={attachment.height ?? undefined}
      loading="lazy"
      data-journal-media-image
      data-journal-media-thumbnail={thumbnail ? "true" : undefined}
      className={cn("block aspect-[4/3] h-auto max-h-36 w-full rounded-md object-cover", imageClassName)}
    />
  );

  return (
    <div className="w-full" data-journal-media-figure>
      <figure className={cn("m-0 w-full text-left", className)}>
        {onClick ? (
          <button
            type="button"
            className="block cursor-zoom-in rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onClick}
          >
            {image}
          </button>
        ) : image}
        {item.caption && (
          <figcaption className={cn("mt-2 text-sm leading-5 text-muted-foreground", captionClassName)}>
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
  mediaGridClassName,
  mediaClassName,
  imageClassName,
  captionClassName,
  lineClamp = false,
  thumbnail = false,
  visibleMediaLimit,
  interactiveLinks = true,
}: JournalEntryMediaContentProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);

  if (lineClamp) {
    return <FormattedNoteContent markdown={markdown} className={className} interactiveLinks={interactiveLinks} />;
  }

  const sortedMedia = sortJournalMedia(media);
  const visibleMedia = typeof visibleMediaLimit === "number"
    ? sortedMedia.slice(0, Math.max(0, visibleMediaLimit))
    : sortedMedia;
  const activeMedia = activeMediaIndex === null ? null : sortedMedia[activeMediaIndex] ?? null;
  const hasMultipleImages = sortedMedia.length > 1;
  const hasMarkdown = markdown.trim().length > 0;

  if (!hasMarkdown && sortedMedia.length === 0) return null;

  function moveLightbox(direction: -1 | 1) {
    setActiveMediaIndex((current) => {
      if (current === null || sortedMedia.length === 0) return current;
      return (current + direction + sortedMedia.length) % sortedMedia.length;
    });
  }

  return (
    <>
      <div className={cn("space-y-3", className)}>
        {hasMarkdown && <FormattedNoteContent markdown={markdown} interactiveLinks={interactiveLinks} />}
        {visibleMedia.length > 0 && (
          <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", mediaGridClassName)}>
            {visibleMedia.map((item) => (
              <JournalMediaFigure
                key={item.id}
                item={item}
                thumbnail={thumbnail}
                className={mediaClassName}
                imageClassName={imageClassName}
                captionClassName={captionClassName}
                onClick={() => setActiveMediaIndex(sortedMedia.findIndex((mediaItem) => mediaItem.id === item.id))}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(activeMedia)} onOpenChange={(open) => {
        if (!open) setActiveMediaIndex(null);
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] border-0 bg-background p-4 sm:max-w-5xl">
          <DialogTitle className="sr-only">Journal image</DialogTitle>
          {activeMedia && (
            <div className="relative flex min-h-[50vh] items-center justify-center px-10">
              {hasMultipleImages && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-0 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
                  aria-label="Previous image"
                  onClick={() => moveLightbox(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <figure className="m-0 flex max-w-full flex-col items-center text-center">
                <img
                  src={activeMedia.url}
                  alt={activeMedia.caption?.trim() || activeMedia.media_attachment.file_name}
                  className="max-h-[78vh] max-w-full rounded-md object-contain"
                />
                {activeMedia.caption && (
                  <figcaption className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {activeMedia.caption}
                  </figcaption>
                )}
              </figure>
              {hasMultipleImages && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
                  aria-label="Next image"
                  onClick={() => moveLightbox(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
