import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, FileText, Heart, Star } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import JournalTimeline from "@/components/JournalTimeline";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import { Button } from "@/components/ui/button";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  formatAuthorPartialDate,
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
import { authorJournalToJournalEntries, sortJournalEntries } from "@/lib/journal";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import { cn } from "@/lib/utils";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, PublicationDatePrecision } from "@/types";

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

function buildLifeLine({
  nationality,
  birth_date,
  birth_date_precision,
  death_date,
  death_date_precision,
}: {
  nationality?: string | null;
  birth_date?: string | null;
  birth_date_precision?: PublicationDatePrecision | null;
  death_date?: string | null;
  death_date_precision?: PublicationDatePrecision | null;
}): string {
  const parts: string[] = [];

  if (nationality) parts.push(nationality);
  if (birth_date) parts.push(`Born ${formatAuthorPartialDate(birth_date, birth_date_precision)}`);
  if (death_date) parts.push(`Died ${formatAuthorPartialDate(death_date, death_date_precision)}`);

  return parts.join(" · ") || "No author details yet.";
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
      <h2 className="text-2xl font-heading leading-snug font-medium">{title}</h2>
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
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

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
        birth_date: author.birth_date,
        birth_date_precision: author.birth_date_precision,
        death_date: author.death_date,
        death_date_precision: author.death_date_precision,
        bio: author.bio,
        is_favorite: !author.isFavorite,
        nationality: author.nationality,
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

  const lifeLine = buildLifeLine(author);
  const booksViewAllPath = `/authors/${encodeURIComponent(author.id)}/books`;
  const bio = author.bio?.trim() || "";
  const shouldClampBio = bio.length > 320 && !bioExpanded;

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
            <h1 className="font-heading text-2xl font-medium leading-tight sm:text-3xl">{author.name}</h1>
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

          <p className="text-sm text-muted-foreground">{lifeLine}</p>

          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <StatTile icon={BookOpen} label="Books Written" value={formatNumber(author.bookCount)} />
            <StatTile icon={FileText} label="Pages Written" value={`~${formatNumber(pagesWritten)}`} />
            <StatTile icon={Star} label="Avg. Rating" value={formatAverageRating(averageRating)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-4">
          <h2 className="mb-4 text-2xl font-heading leading-snug font-medium">
            <span className="font-serif italic">About</span> this author
          </h2>
          {bio ? (
            <div className="space-y-4">
              <p className={cn("whitespace-pre-line text-sm leading-7 text-muted-foreground", shouldClampBio && "line-clamp-4")}>
                {bio}
              </p>
              {bio.length > 320 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-0 text-sm text-muted-foreground"
                  onClick={() => setBioExpanded((current) => !current)}
                >
                  {bioExpanded ? "Show less" : "Show more"}
                  <ChevronRight className={cn("h-4 w-4 transition-transform", bioExpanded && "rotate-90")} />
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No bio yet.</p>
          )}
        </div>
      </section>

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
