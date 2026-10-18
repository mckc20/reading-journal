import { BookOpen, Heart, PauseCircle } from "lucide-react";
import { bookCardInteractiveClassName } from "@/components/BookCardContent";
import { cn } from "@/lib/utils";
import type { SeriesBookGroup } from "@/lib/libraryShelves";
import type { Book } from "@/types";

function bookCountLabel(count: number) {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function SeriesCoverLayer({
  book,
  index,
  isFavorite,
  variant,
}: {
  book: Book;
  index: number;
  isFavorite?: boolean;
  variant: "grid" | "shelf";
}) {
  const layerStyles = [
    "z-30 translate-x-0 translate-y-0 rotate-0 opacity-100 group-hover:translate-x-0.5 group-hover:rotate-[-0.5deg]",
    variant === "grid"
      ? "z-20 translate-x-1 -translate-y-1 rotate-[2deg] opacity-75 group-hover:translate-x-1.5"
      : "z-20 translate-x-2 -translate-y-1 rotate-[3deg] opacity-75 group-hover:translate-x-3 group-hover:rotate-[4deg]",
    variant === "grid"
      ? "z-10 translate-x-2 -translate-y-2 rotate-[3deg] opacity-55 group-hover:translate-x-2.5"
      : "z-10 translate-x-4 -translate-y-2 rotate-[5deg] opacity-55 group-hover:translate-x-5 group-hover:rotate-[6deg]",
  ];

  return (
    <div
      aria-hidden={index > 0}
      className={cn(
        "absolute left-0 top-0 aspect-[2/3] w-full overflow-hidden rounded-md bg-muted shadow-md ring-1 ring-border transition-transform duration-300 ease-out motion-reduce:transition-none",
        layerStyles[index],
        book.status === "Paused" && "opacity-70",
      )}
    >
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt={index === 0 ? book.title : ""}
          loading="lazy"
          className={cn("block h-full w-full scale-[1.035] object-cover object-top", book.status === "Paused" && "grayscale")}
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
      {isFavorite && index === 0 && (
        <span className="absolute right-1.5 top-1.5 z-40">
          <Heart className="h-4 w-4 fill-favorite text-favorite drop-shadow" aria-hidden="true" />
          <span className="sr-only">Favorite series</span>
        </span>
      )}
    </div>
  );
}

export default function SeriesStackCard({
  group,
  onSeries,
  interactive = true,
  selected = false,
  showBookCount = true,
  variant = "shelf",
}: {
  group: SeriesBookGroup;
  onSeries: (seriesId: string) => void;
  interactive?: boolean;
  selected?: boolean;
  showBookCount?: boolean;
  variant?: "grid" | "shelf";
}) {
  const visibleBooks = group.books.slice(0, 3);

  return (
    <button
      type="button"
      onClick={interactive ? () => onSeries(group.seriesId) : undefined}
      className={cn("group block min-w-0 shrink-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", variant === "shelf" ? "w-[122px] sm:w-[148px]" : "w-full", interactive && bookCardInteractiveClassName, selected && "bg-muted")}
      data-shelf-item
      aria-disabled={!interactive}
    >
      <div className={cn("relative mt-2 aspect-[2/3]", variant === "shelf" ? "w-[90px] sm:w-[112px]" : "w-full")}>
        {visibleBooks.length === 0 && (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-muted shadow-md">
            <BookOpen className="h-1/3 w-1/3 text-muted-foreground/40" />
            {group.isFavorite && <Heart className="absolute right-1.5 top-1.5 h-4 w-4 fill-favorite text-favorite" aria-label="Favorite series" />}
          </div>
        )}
        {[...visibleBooks].reverse().map((book, reversedIndex) => {
          const index = visibleBooks.length - 1 - reversedIndex;

          return (
            <SeriesCoverLayer
              key={book.id}
              book={book}
              index={index}
              isFavorite={group.isFavorite}
              variant={variant}
            />
          );
        })}
      </div>
      <div className="mt-3 min-w-0">
        {selected ? (
          <div className="inline-block max-w-full rounded bg-primary px-1.5 py-0.5 text-primary-foreground">
            <p className="line-clamp-2 text-sm font-medium leading-relaxed underline-offset-4">{group.name}</p>
          </div>
        ) : (
          <p className="line-clamp-2 text-sm font-medium leading-relaxed underline-offset-4 text-foreground group-hover:underline group-focus-visible:underline">{group.name}</p>
        )}
        {showBookCount && <p className="mt-1 text-[11px] text-muted-foreground">{bookCountLabel(group.books.length)}</p>}
      </div>
    </button>
  );
}
