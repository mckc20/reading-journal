import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, Heart, Star } from "lucide-react";
import QuoteBlock from "@/components/QuoteBlock";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBooksContext } from "@/context/BooksContext";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  formatAuthorDate,
  formatAuthorYear,
  getAuthorInitials,
} from "@/lib/authorShelf";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import { cn } from "@/lib/utils";
import type { Book, BookNote } from "@/types";

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function BookCover({ book, size = "md" }: { book: Book; size?: "sm" | "md" }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className={cn(
        "group block shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        size === "sm" ? "w-14" : "w-20",
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-muted shadow-sm",
          size === "sm" ? "h-20 w-14" : "h-[120px] w-20",
        )}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium leading-tight">{book.title}</p>
      {book.rating ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-current text-amber-500" />
          {book.rating}
        </p>
      ) : null}
    </Link>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-lg font-medium leading-snug">{title}</h2>
      {action}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function AuthorPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-sky-950 text-5xl font-medium text-white shadow-sm sm:h-40 sm:w-40 sm:text-6xl">
      {getAuthorInitials(name)}
    </div>
  );
}

export default function AuthorDetails() {
  const { authorName } = useParams();
  const navigate = useNavigate();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch((error) => {
        if (!ignore) {
          setNotesError(error instanceof Error ? error.message : "Failed to load quotes");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(() => buildAuthorSummaries(books, notes), [books, notes]);
  const author = useMemo(() => findAuthorSummary(authors, authorName), [authors, authorName]);
  const featuredQuote = author?.quotes.find((quote) => quote.is_favorite) ?? author?.quotes[0];
  const featuredQuoteBook = featuredQuote
    ? author?.books.find((book) => book.id === featuredQuote.book_id)
    : undefined;

  if (booksLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (booksError) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
        {booksError}
      </div>
    );
  }

  if (!author) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/authors")}>
          <ArrowLeft className="h-4 w-4" />
          Back to authors
        </Button>
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-heading text-lg font-medium">Author not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This author was not found in your current library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5 border-b pb-6">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/authors")}>
            <ArrowLeft className="h-4 w-4" />
            Back to authors
          </Button>
          {author.isFavorite && (
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
              Favorite
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
          <AuthorPlaceholder name={author.name} />
          <div className="max-w-3xl space-y-3">
            <h1 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">
              {author.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>{countLabel(author.bookCount, "book")}</span>
              <span>{countLabel(author.quoteCount, "quote")}</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {author.averageRating ?? "No rating"} average rating
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              First read in {formatAuthorYear(author.firstReadDate)}
              <span className="px-2">.</span>
              Latest read in {formatAuthorYear(author.latestReadDate)}
            </p>

            {featuredQuote && (
              <QuoteBlock
                contentClassName="text-base leading-7"
                attribution={
                  <>
                    {featuredQuote.quote_speaker ? `${featuredQuote.quote_speaker}, ` : ""}
                    {featuredQuoteBook?.title ?? formatAuthorDate(featuredQuote.note_date)}
                  </>
                }
              >
                {featuredQuote.content}
              </QuoteBlock>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList
          variant="line"
          className="w-full justify-start gap-8 rounded-none border-b pb-0"
        >
          <TabsTrigger value="overview" className="min-w-20 px-0">
            Overview
          </TabsTrigger>
          <TabsTrigger value="books" className="min-w-20 px-0">
            Books
          </TabsTrigger>
          <TabsTrigger value="quotes" className="min-w-20 px-0">
            Quotes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-lg border bg-card p-4">
              <SectionHeader
                title={`Books by ${author.name}`}
                action={
                  <Link
                    to={`/library/explore?view=authors&value=${encodeURIComponent(author.name)}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View all
                  </Link>
                }
              />
              <div className="flex gap-3 overflow-x-auto pb-2">
                {author.books.slice(0, 5).map((book) => (
                  <BookCover key={book.id} book={book} size="sm" />
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border bg-card p-4">
              <SectionHeader title="Favorite Quote" />
              {notesError ? (
                <p className="text-sm text-muted-foreground">Quotes could not be loaded right now.</p>
              ) : featuredQuote ? (
                <QuoteBlock
                  contentClassName="text-base leading-7"
                  attribution={`- ${
                    featuredQuoteBook?.title ?? formatAuthorDate(featuredQuote.note_date)
                  }`}
                >
                  {featuredQuote.content}
                </QuoteBlock>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Quotes from this author's books will appear here.
                </p>
              )}
            </section>
          </div>

          <section className="space-y-4">
            <SectionHeader title="Reading Journey" />
            {author.books.length === 0 ? (
              <EmptySection message="Books by this author will appear here." />
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max items-start gap-6">
                  {author.books.map((book, index) => (
                    <div key={book.id} className="relative w-24 shrink-0">
                      {index > 0 && (
                        <div className="absolute -left-6 top-10 h-px w-6 bg-border" aria-hidden />
                      )}
                      <BookCover book={book} size="sm" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatAuthorYear(book.date_finished ?? book.date_started ?? null)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="books" className="space-y-4">
          <SectionHeader
            title="Books"
            action={
              <Link
                to={`/library/explore?view=authors&value=${encodeURIComponent(author.name)}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all books
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {author.shelfGroups.map((group) => (
              <div key={group.key} className="min-w-0 border-l pl-4">
                <h3 className="mb-3 text-sm font-medium">
                  {group.title} ({group.books.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {group.books.slice(0, 4).map((book) => (
                    <BookCover key={book.id} book={book} size="sm" />
                  ))}
                  {group.books.length > 4 && (
                    <Link
                      to={`/library/explore?view=authors&value=${encodeURIComponent(author.name)}`}
                      className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border bg-muted/30 text-xs text-muted-foreground hover:text-foreground"
                    >
                      +{group.books.length - 4}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <SectionHeader title="Quotes" />
          {notesError ? (
            <EmptySection message="Quotes could not be loaded right now." />
          ) : author.quotes.length === 0 ? (
            <EmptySection message="Quotes from this author's books will appear here." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {author.quotes.map((quote) => {
                const quoteBook = author.books.find((book) => book.id === quote.book_id);

                return (
                  <article key={quote.id} className="min-h-44 rounded-lg border bg-card p-4">
                    <QuoteBlock
                      contentClassName="line-clamp-5"
                      attribution={
                        quoteBook ? `- ${quoteBook.title}` : formatAuthorDate(quote.note_date)
                      }
                      actions={
                        quote.is_favorite ? (
                          <Heart className="h-4 w-4 shrink-0 fill-rose-500 text-rose-500" />
                        ) : null
                      }
                    >
                      {quote.content}
                    </QuoteBlock>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
