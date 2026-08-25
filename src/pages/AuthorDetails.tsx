import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, FileText, Heart, Star } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import { AboutSection, AppHeading } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import JournalTimeline from "@/components/JournalTimeline";
import {
  buildBookLibraryFilterPath,
  buildGenreDetailPath,
  MetadataGroup,
} from "@/components/LinkedMetadata";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  getAuthorAverageRating,
  getAuthorInitials,
  getAuthorPagesWritten,
} from "@/lib/authorShelf";
import {
  fetchAuthorJournalEntryRecords,
  sortAuthorJournalEntryRecords,
} from "@/lib/authorJournal";
import { buildAuthorAttachment } from "@/lib/chatAttachments";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { buildGenreSlugLookup } from "@/lib/genreTree";
import { authorJournalToJournalEntries, sortJournalEntries } from "@/lib/journal";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import { cn } from "@/lib/utils";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord } from "@/types";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatAverageRating(value: number | null): string {
  return value === null ? "No rating" : value.toFixed(2);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

function AuthorPhoto({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  return (
    <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-5xl font-medium text-primary-foreground shadow-sm sm:h-40 sm:w-40 sm:text-6xl">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        getAuthorInitials(name)
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-medium leading-none sm:text-3xl">{value}</p>
    </div>
  );
}

function SectionTitle({
  title,
  action,
}: {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <AppHeading level={2} as="h2">{title}</AppHeading>
      {action}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/55 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function uniqueSortedValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

function getTopValues(values: Array<string | null | undefined>, limit: number): string[] {
  const counts = new Map<string, { value: string; count: number }>();

  values.forEach((rawValue) => {
    const value = rawValue?.trim();
    if (!value) return;
    const key = value.toLocaleLowerCase();
    const current = counts.get(key);
    counts.set(key, {
      value: current?.value ?? value,
      count: (current?.count ?? 0) + 1,
    });
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { sensitivity: "base", numeric: true }))
    .slice(0, limit)
    .map((item) => item.value);
}

function AuthorJournalSection({ author }: { author: { id: string; name: string } }) {
  const [authorJournal, setAuthorJournalEntryRecords] = useState<AuthorJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const journalEntries = useMemo(
    () => sortJournalEntries(authorJournalToJournalEntries(authorJournal)).slice(0, 3),
    [authorJournal],
  );

  const loadAuthorJournalEntryRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAuthorJournalEntryRecords(await fetchAuthorJournalEntryRecords(author.id));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load author journal entries"));
    } finally {
      setLoading(false);
    }
  }, [author.id]);

  useEffect(() => {
    void loadAuthorJournalEntryRecords();
  }, [loadAuthorJournalEntryRecords]);

  return (
    <section className="space-y-4">
      <SectionTitle
        title={<span className="font-serif italic">Journal</span>}
        action={
          <Button asChild variant="link" className="px-0 text-primary">
            <Link to={`/authors/${author.id}/journal`}>
              Open journal
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        journalEntries.length === 0 ? (
          <EmptySection message="Author journal entries will appear here." />
        ) : (
          <JournalTimeline
            entries={journalEntries}
            layout="cards"
            previewMode={{
              getEntryHref: (entry) => `/authors/${author.id}/journal?entry=${encodeURIComponent(entry.sourceId)}`,
            }}
            emptyMessage="Author journal entries will appear here."
            onEntryUpdated={(entry) => {
              if (entry.source === "author_note") {
                setAuthorJournalEntryRecords((current) => sortAuthorJournalEntryRecords([entry.authorJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
              }
            }}
            onEntryDeleted={(entry) => {
              if (entry.source === "author_note") setAuthorJournalEntryRecords((current) => current.filter((note) => note.id !== entry.sourceId));
            }}
          />
        )
      )}
    </section>
  );
}

export default function AuthorDetails() {
  const { authorId } = useParams();
  const navigate = useNavigate();
  const {
    authors: authorRecords,
    loading: authorsLoading,
    error: authorsError,
    editAuthor,
    removeAuthor,
  } = useAuthorsContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { genres } = useGenresContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!ignore) setJournalEntries(data);
      })
      .catch(() => {
        if (!ignore) {
          setJournalEntries([]);
        }
      })
      .finally(() => {
        if (!ignore) setJournalEntriesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, journalEntries), [authorRecords, books, journalEntries]);
  const author = useMemo(() => findAuthorSummary(authors, authorId), [authors, authorId]);
  const authorBooks = author?.books ?? [];
  const previewBooks = authorBooks.slice(0, 4);
  const authorSeries = useMemo(() => buildSeriesGroups(authorBooks, series), [authorBooks, series]);
  const averageRating = useMemo(() => getAuthorAverageRating(author ?? { books: [] }), [author]);
  const pagesWritten = useMemo(() => (author ? getAuthorPagesWritten(author) : 0), [author]);
  const authorGenres = useMemo(
    () => getTopValues(authorBooks.flatMap((book) => book.genres ?? []), 6),
    [authorBooks],
  );
  const authorLanguages = useMemo(
    () => uniqueSortedValues(authorBooks.map((book) => book.language)).slice(0, 4),
    [authorBooks],
  );
  const genreSlugByName = useMemo(() => {
    const { slugById } = buildGenreSlugLookup(genres);
    return new Map(
      genres.map((genre) => [genre.name.toLocaleLowerCase(), slugById.get(genre.id) ?? genre.id]),
    );
  }, [genres]);
  const loading = authorsLoading || booksLoading || journalEntriesLoading || seriesLoading;

  function openAttachmentPicker() {
    setSendAttachmentOpen(true);
  }

  async function handleDeleteAuthor() {
    if (!author) return;

    try {
      setActionError(null);
      await removeAuthor(author.id);
      navigate("/authors", { replace: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete author");
    }
  }

  async function handleToggleFavorite() {
    if (!author) return;

    try {
      setActionError(null);
      await editAuthor(author.id, {
        name: author.name,
        photo_url: author.photo_url,
        bio: author.bio,
        is_favorite: !author.isFavorite,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update author");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (booksError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError}</div>;
  }

  if (authorsError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{authorsError}</div>;
  }

  if (seriesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{seriesError}</div>;
  }

  if (!author) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/authors" />
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-heading text-lg font-medium">Author not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This author was not found in your current library.
          </p>
        </div>
      </div>
    );
  }

  const booksViewAllPath = `/authors/${encodeURIComponent(author.id)}/books`;
  const bio = author.bio?.trim() || "";
  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-3">
        <BackButton fallbackTo="/authors" />

        <DetailActionsMenu
          kind="author"
          label={author.name}
          shareAttachmentLabel="Send the author as attachment in a chat"
          onEdit={() => setAuthorDialogOpen(true)}
          onDelete={() => void handleDeleteAuthor()}
          onSendAttachment={openAttachmentPicker}
          deleteTitle="Delete this author?"
          deleteDescription="Deleting this author removes the record and unlinks it from books. The books stay in your library."
        />
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {shareStatus && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
          {shareStatus}
        </div>
      )}

      <section className="flex items-start gap-4 sm:gap-6">
        <AuthorPhoto name={author.name} photoUrl={author.photo_url} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <AppHeading level={1}>{author.name}</AppHeading>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={author.isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="shrink-0 rounded p-1 transition-colors hover:bg-muted"
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  author.isFavorite ? "fill-favorite text-favorite" : "text-muted-foreground",
                )}
              />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <StatTile icon={BookOpen} label="Books Written" value={formatNumber(author.bookCount)} />
            <StatTile icon={FileText} label="Pages Written" value={`~${formatNumber(pagesWritten)}`} />
            <StatTile icon={Star} label="Avg. Rating" value={formatAverageRating(averageRating)} />
          </div>
        </div>
      </section>

      {(authorGenres.length > 0 || authorLanguages.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {authorLanguages.length > 0 && (
            <MetadataGroup title="Languages">
              <div className="flex flex-wrap gap-1.5">
                {authorLanguages.map((language) => (
                  <Badge key={language} variant="outline" className="max-w-full font-normal" asChild>
                    <Link to={buildBookLibraryFilterPath("language", language)}>
                      {language}
                    </Link>
                  </Badge>
                ))}
              </div>
            </MetadataGroup>
          )}

          {authorGenres.length > 0 && (
            <MetadataGroup title="Genres">
              <div className="flex flex-wrap gap-1.5">
                {authorGenres.map((genre) => {
                  const slug = genreSlugByName.get(genre.toLocaleLowerCase());
                  return (
                    <Badge key={genre} variant="outline" className="max-w-full font-normal" asChild>
                      <Link to={slug ? buildGenreDetailPath(slug) : buildBookLibraryFilterPath("genre", genre)}>
                        {genre}
                      </Link>
                    </Badge>
                  );
                })}
              </div>
            </MetadataGroup>
          )}
        </section>
      )}

      <AboutSection
        title={
          <>
            <span className="font-serif italic">About</span> this author
          </>
        }
        text={bio}
        emptyText="No bio yet."
      />

      <AuthorJournalSection author={author} />

      <section className="space-y-4">
        <SectionTitle
          title={
            <>
              <span className="font-serif italic">Books</span>
            </>
          }
          action={
            <Button asChild variant="link" className="px-0 text-primary">
              <Link to={booksViewAllPath}>
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        {previewBooks.length === 0 ? (
          <EmptySection message="Books by this author will appear here." />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4">
            {previewBooks.map((book) => (
              <BookCard key={book.id} book={book} onClick={() => navigate(`/books/${book.id}`)} textSize="compact" />
            ))}
          </div>
        )}
      </section>

      {authorSeries.length > 0 && (
        <section className="space-y-4">
          <SectionTitle
            title={
              <>
                <span className="font-serif italic">Series</span>
              </>
            }
          />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
            {authorSeries.map((group) => (
              <SeriesStackCard key={group.seriesId} group={group} onSeries={(seriesId) => navigate(`/series/${seriesId}`)} />
            ))}
          </div>
        </section>
      )}

      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildAuthorAttachment({
          authorId: author.id,
          authorName: author.name,
          books: authorBooks,
          includedQuotes: author.quotes.slice(0, 3),
        })}
        title={`Send "${author.name}" to chat`}
        description="Add a message, then pick the chat you want to send this author to."
        onSent={() => setShareStatus("Author sent to chat.")}
      />
      <AddAuthorDialog open={authorDialogOpen} onOpenChange={setAuthorDialogOpen} initialAuthor={author} />
    </div>
  );
}
