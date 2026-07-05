import { BookOpen, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeriesBookGroup } from "@/lib/libraryShelves";
import type { Book } from "@/types";

function bookCountLabel(count: number) {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function SeriesCoverLayer({
  book,
  index,
}: {
  book: Book;
  index: number;
}) {
  const layerStyles = [
    "z-30 translate-x-0 translate-y-0 rotate-0 opacity-100 group-hover:translate-x-0.5 group-hover:rotate-[-0.5deg]",
    "z-20 translate-x-2 -translate-y-1 rotate-[3deg] opacity-75 group-hover:translate-x-3 group-hover:rotate-[4deg]",
    "z-10 translate-x-4 -translate-y-2 rotate-[5deg] opacity-55 group-hover:translate-x-5 group-hover:rotate-[6deg]",
  ];

  return (
    <div
      aria-hidden={index > 0}
      className={cn(
        "absolute left-0 top-2 h-[135px] w-[90px] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-transform duration-300 ease-out motion-reduce:transition-none sm:h-[168px] sm:w-[112px]",
        layerStyles[index],
        book.status === "Paused" && "opacity-70",
      )}
    >
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt={index === 0 ? book.title : ""}
          loading="lazy"
          className={cn("block h-full w-full scale-[1.035] object-cover", book.status === "Paused" && "grayscale")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      {book.status === "Paused" && index === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
          <PauseCircle className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default function SeriesStackCard({
  group,
  onSeries,
}: {
  group: SeriesBookGroup;
  onSeries: (seriesId: string) => void;
}) {
  const visibleBooks = group.books.slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => onSeries(group.seriesId)}
      className="group block w-[122px] shrink-0 rounded-lg text-left transition-shadow duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[148px]"
      data-shelf-item
    >
      <div className="relative h-[145px] w-[122px] sm:h-[178px] sm:w-[148px]">
        {visibleBooks.length === 0 ? (
          <div className="absolute left-0 top-2 flex h-[135px] w-[90px] items-center justify-center overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-colors group-hover:bg-muted/80 sm:h-[168px] sm:w-[112px]">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        ) : (
          [...visibleBooks].reverse().map((book, reversedIndex) => {
            const index = visibleBooks.length - 1 - reversedIndex;

            return <SeriesCoverLayer key={book.id} book={book} index={index} />;
          })
        )}
      </div>
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
          {group.name}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {bookCountLabel(group.books.length)}
        </p>
      </div>
    </button>
  );
}
