import LoadingIndicator from "@/components/LoadingIndicator";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BookOpen, NotebookPen, Star } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import { AboutSection } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { BookHighlights } from "@/components/redesign/BookHighlights";
import { DetailGenreTags, DetailHero, DetailStat } from "@/components/redesign/DetailHero";
import { DetailBooks } from "@/components/redesign/DetailBooks";
import { DetailJournal, useDetailJournalEditor, useDetailJournalEntries } from "@/components/redesign/DetailJournal";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import { Button } from "@/components/ui/button";
import { useAuth, useUserSettings } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  getAuthorAverageRating,
  getAuthorInitials,
} from "@/lib/authorShelf";
import { fetchAuthorJournalEntryRecords } from "@/lib/authorJournal";
import { buildAuthorAttachment } from "@/lib/chatAttachments";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { getBookRankings } from "@/lib/bookRankings";
import { buildGenreSlugLookup } from "@/lib/genreTree";
import { authorJournalToJournalEntries } from "@/lib/journal";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import { duplicateAuthorRecord } from "@/lib/duplication";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import HorizontalShelf from "@/pages/library/HorizontalShelf";
import SeriesStackCard from "@/pages/library/SeriesStackCard";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="rj-detail-portrait" aria-hidden="true">
      {photoUrl && photoUrl !== failedUrl ? (
        <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setFailedUrl(photoUrl)} />
      ) : getAuthorInitials(name)}
    </div>
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

const authorDetailLabel = "Author details";
const authorFallback = "/authors";

export default function AuthorDetails() {
  const { authorId } = useParams();
  return (
    <DetailSheet key={authorId} label={authorDetailLabel} fallbackTo={authorFallback}>
      {(close) => <AuthorDetailsContent authorId={authorId} onClose={close} />}
    </DetailSheet>
  );
}

function AuthorDetailsContent({ authorId, onClose }: { authorId?: string; onClose: () => void }) {
  const headingId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const {
    authors: authorRecords,
    loading: authorsLoading,
    error: authorsError,
    editAuthor,
    removeAuthor,
    reload: reloadAuthors,
  } = useAuthorsContext();
  const { books, wishlistBooks, loading: booksLoading, error: booksError, reload: reloadBooks } = useBooksContext();
  const { genres } = useGenresContext();
  const { series, loading: seriesLoading, error: seriesError } = useSeries();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [sendAttachmentOpen, setSendAttachmentOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const editTriggerRef = useRef<HTMLElement | null>(null);
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

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, journalEntries, wishlistBooks), [authorRecords, books, journalEntries, wishlistBooks]);
  const author = useMemo(() => findAuthorSummary(authors, authorId), [authors, authorId]);
  useEffect(() => {
    if (!author || location.state?.openEdit !== true) return;
    setEditOpen(true);
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null });
  }, [author, location, navigate]);
  const heroColor = useBookHeroColor(author?.photo_url);
  const authorBooks = author?.books ?? [];
  const authorSeries = useMemo(() => buildSeriesGroups(authorBooks, series), [authorBooks, series]);
  const averageRating = useMemo(() => getAuthorAverageRating(author ?? { books: [] }), [author]);
  const authorGenres = useMemo(
    () => getTopValues(authorBooks.flatMap((book) => book.genres ?? []), 6),
    [authorBooks],
  );
  const authorRankings = useMemo(() => getBookRankings(authorBooks, journalEntries), [authorBooks, journalEntries]);
  const genreSlugByName = useMemo(() => {
    const { slugById } = buildGenreSlugLookup(genres);
    return new Map(
      genres.map((genre) => [genre.name.toLocaleLowerCase(), slugById.get(genre.id) ?? genre.id]),
    );
  }, [genres]);
  const loading = authorsLoading || booksLoading || journalEntriesLoading || seriesLoading;
  const authorJournal = useDetailJournalEntries(author?.id, fetchAuthorJournalEntryRecords, authorJournalToJournalEntries);
  const saveJournalEntry = useCallback((record: AuthorJournalEntryRecord | BookJournalEntryRecord | SeriesJournalEntryRecord) => {
    if ("author_id" in record && record.author_id === author?.id) authorJournal.save(record);
  }, [author?.id, authorJournal.save]);
  const journalEditor = useDetailJournalEditor("Author", !loading && !editOpen && user ? author?.id : undefined, saveJournalEntry);

  function openAttachmentPicker() {
    setSendAttachmentOpen(true);
  }

  async function duplicateCurrentAuthor(options: DuplicateOptions) {
    if (!author || !user) return;
    try {
      setActionError(null);
      const duplicate = await duplicateAuthorRecord(author, books, user.id, options);
      setDuplicateOpen(false);
      await Promise.all([reloadAuthors(), reloadBooks()]);
      navigate(`/authors/${encodeURIComponent(duplicate.id)}`, { state: { openEdit: true } });
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to duplicate author"));
    }
  }

  function openDuplicateDialog() {
    if (!author || !user) return;
    const library = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
    const resolved = resolveDuplicateOptions("author", library.duplicate_journal_entries, library.duplicate_books, authorBooks.length);
    if (resolved.needsDialog) {
      setDuplicateOpen(true);
      return;
    }
    void duplicateCurrentAuthor(resolved.options);
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

  const back = <DetailBack label={authorDetailLabel} fallbackTo={authorFallback} onClose={onClose} />;
  if (loading) {
    return <div className="rj-detail-page">{back}<LoadingIndicator variant="page" /></div>;
  }

  const error = booksError || authorsError || seriesError;
  if (error) {
    return <div className="rj-detail-page">{back}<p role="alert" className="text-sm text-destructive">{error}</p></div>;
  }

  if (!author) {
    return (
      <div className="rj-detail-page space-y-4">
        {back}
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-heading text-lg font-medium">Author not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This author was not found in your current library.
          </p>
        </div>
      </div>
    );
  }

  const bio = author.bio?.trim() || "";
  return (
    <div className="rj-detail-page">
      <DetailHero
        titleId={headingId}
        color={heroColor}
        navigation={back}
        artwork={<AuthorPhoto name={author.name} photoUrl={author.photo_url} />}
        actions={
          <DetailActionsMenu
            kind="author"
            label={author.name}
            shareAttachmentLabel="Send the author as attachment in a chat"
            onEdit={(trigger) => {
              editTriggerRef.current = trigger ?? null;
              setEditOpen(true);
            }}
            onDuplicate={openDuplicateDialog}
            onDelete={() => void handleDeleteAuthor()}
            onSendAttachment={openAttachmentPicker}
            deleteTitle="Delete this author?"
            deleteDescription="Deleting this author removes the record and unlinks it from books. The books stay in your library."
          />
        }
      >
        <BookDetailTitle
          id={headingId}
          title={author.name}
          favorite={author.isFavorite}
          onToggleFavorite={() => void handleToggleFavorite()}
        />
        <div className="rj-detail-actions">
          <Button ref={journalEditor.triggerRef} type="button" variant="outline" disabled={!user} onClick={(event) => journalEditor.launch(event.currentTarget)}>
            <NotebookPen aria-hidden="true" />
            Add entry
          </Button>
        </div>
        {actionError && <p role="alert" className="rj-detail-notice text-sm text-destructive">{actionError}</p>}
        {shareStatus && <p role="status" className="rj-detail-notice text-sm">{shareStatus}</p>}
      </DetailHero>

      <div className="rj-detail-body">
        <dl className="rj-reading-stats rj-detail-summary-stats">
          <DetailStat icon={BookOpen} label="Books written" value={formatNumber(author.bookCount)} />
          <DetailStat icon={Star} label="Average rating" value={formatAverageRating(averageRating)} />
        </dl>

        <AboutSection
          className="rj-detail-description"
          title="About this author"
          text={bio}
          titleContent={<DetailGenreTags genres={authorGenres} slugByName={genreSlugByName} />}
        />

        <DetailBooks books={authorBooks} />

        {authorSeries.length > 0 && (
          <section aria-labelledby={`${headingId}-series`} className="min-w-0 space-y-4">
            <h2 id={`${headingId}-series`}>Series</h2>
            <div className="rj-home-shelf-frame">
              <HorizontalShelf title="Series">
                {authorSeries.map((group) => (
                  <SeriesStackCard key={group.seriesId} group={group} onSeries={(seriesId) => navigate(`/series/${encodeURIComponent(seriesId)}`)} />
                ))}
              </HorizontalShelf>
            </div>
          </section>
        )}

        <section aria-labelledby={`${headingId}-insights`} className="space-y-4">
          <h2 id={`${headingId}-insights`}>Insights</h2>
          <BookHighlights rankings={authorRankings} label="Author book highlights" />
        </section>

        <DetailJournal
          sectionId="journal"
          entries={authorJournal.entries}
          loading={authorJournal.loading}
          error={authorJournal.error}
          onAdd={journalEditor.launch}
          onEntryUpdated={(entry) => { if (entry.source === "author_note") authorJournal.save(entry.authorJournalEntry); }}
          onEntryDeleted={(entry) => { if (entry.source === "author_note") authorJournal.remove(entry.sourceId); }}
          addDisabled={!user}
        />
      </div>

      {editOpen && (
        <AddAuthorDialog
          open
          initialAuthor={authorRecords.find((record) => record.id === author.id) ?? author}
          onOpenChange={setEditOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editTriggerRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
      <SendAttachmentDialog
        open={sendAttachmentOpen}
        onOpenChange={setSendAttachmentOpen}
        attachment={buildAuthorAttachment({
          authorId: author.id,
          authorName: author.name,
          authorPhotoUrl: author.photo_url,
          authorBio: author.bio,
          books: authorBooks,
          includedQuotes: author.quotes.slice(0, 3),
        })}
        title={`Send "${author.name}" to chat`}
        description="Add a message, then pick the chat you want to send this author to."
        onSent={() => setShareStatus("Author sent to chat.")}
      />
      <DuplicateOptionsDialog
        open={duplicateOpen}
        kind="author"
        linkedBookCount={authorBooks.length}
        journalPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_journal_entries}
        booksPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_books}
        onOpenChange={setDuplicateOpen}
        onConfirm={duplicateCurrentAuthor}
      />
    </div>
  );
}
