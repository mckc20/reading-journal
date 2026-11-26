import LoadingIndicator from "@/components/LoadingIndicator";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import { AboutSection } from "@/components/design";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import { BookDetailTitle } from "@/components/redesign/BookDetailTitle";
import { BookHighlights } from "@/components/redesign/BookHighlights";
import { DetailGenreTags, DetailHero } from "@/components/redesign/DetailHero";
import { DetailBooks } from "@/components/redesign/DetailBooks";
import { useDetailJournalEditor } from "@/components/redesign/DetailJournal";
import { DetailBack, DetailSheet } from "@/components/redesign/DetailSheet";
import SendAttachmentDialog from "@/components/SendAttachmentDialog";
import { Button } from "@/components/ui/button";
import { useAuth, useUserSettings } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { useSeries } from "@/hooks/useSeries";
import {
  buildAuthorSummaries,
  findAuthorSummary,
  getBooksByAuthor,
  getAuthorInitials,
} from "@/lib/authorShelf";
import { buildAuthorAttachment } from "@/lib/chatAttachments";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { getBookRankings } from "@/lib/bookRankings";
import { buildSeriesGroups } from "@/lib/libraryShelves";
import { duplicateAuthorRecord } from "@/lib/duplication";
import { entityJournalHref } from "@/lib/journalLinks";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import HorizontalShelf from "@/pages/library/HorizontalShelf";
import { SeriesCard } from "@/components/redesign/SeriesCard";
import type { BookJournalEntryRecord } from "@/types";

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
  const [searchParams] = useSearchParams();
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

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, journalEntries, wishlistBooks, { includeWishlistAuthors: true }), [authorRecords, books, journalEntries, wishlistBooks]);
  const author = useMemo(() => findAuthorSummary(authors, authorId), [authors, authorId]);
  useEffect(() => {
    if (!author || location.state?.openEdit !== true) return;
    setEditOpen(true);
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null });
  }, [author, location, navigate]);
  const heroColor = useBookHeroColor(author?.photo_url);
  const authorBooks = author?.books ?? [];
  const authorWishes = useMemo(() => author ? getBooksByAuthor(wishlistBooks, author.name) : [], [author, wishlistBooks]);
  const wishlistView = authorWishes.length > 0 && (authorBooks.length === 0
    || authorWishes.some(book => book.id === searchParams.get("wishlistBook")));
  const authorSeries = useMemo(() => buildSeriesGroups([...authorBooks, ...authorWishes], series), [authorBooks, authorWishes, series]);
  const genreBooks = wishlistView ? authorWishes : authorBooks;
  const authorGenres = useMemo(
    () => getTopValues(genreBooks.flatMap((book) => book.genres ?? []), 6),
    [genreBooks],
  );
  const authorRankings = useMemo(() => getBookRankings(authorBooks, journalEntries), [authorBooks, journalEntries]);
  const loading = authorsLoading || booksLoading || journalEntriesLoading || seriesLoading;
  const journalEditor = useDetailJournalEditor("Author", !loading && !editOpen && !wishlistView && user ? author?.id : undefined);

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

  if (authorId && searchParams.get("new") !== "1" && (location.hash === "#journal" || searchParams.has("entry"))) {
    return <Navigate to={entityJournalHref("author", authorId, searchParams)} replace />;
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
        {!wishlistView && <div className="rj-detail-actions">
          <Button ref={journalEditor.triggerRef} type="button" variant="outline" disabled={!user} onClick={(event) => journalEditor.launch(event.currentTarget)}>
            <NotebookPen aria-hidden="true" />
            Add entry
          </Button>
        </div>}
        {actionError && <p role="alert" className="rj-detail-notice text-sm text-destructive">{actionError}</p>}
        {shareStatus && <p role="status" className="rj-detail-notice text-sm">{shareStatus}</p>}
      </DetailHero>

      <div className="rj-detail-body">
        <AboutSection
          className="rj-detail-description"
          title="About this author"
          text={bio}
          titleContent={<DetailGenreTags genres={authorGenres} linked={!wishlistView} />}
        />

        {(authorBooks.length > 0 || authorWishes.length === 0) && <DetailBooks books={authorBooks} />}
        {authorWishes.length > 0 && <DetailBooks books={authorWishes} title="In Wishlist"
          sectionId={authorBooks.length > 0 ? "wishlist-books" : "books"} />}

        {authorSeries.length > 0 && (
          <section aria-labelledby={`${headingId}-series`} className="min-w-0 space-y-4">
            <h2 id={`${headingId}-series`}>Series</h2>
            <div className="rj-home-shelf-frame">
              <HorizontalShelf title="Series">
                {authorSeries.map((group) => (
                  <SeriesCard key={group.seriesId} title={group.name} books={group.books} shelf favorite={group.isFavorite}
                    onOpen={() => navigate(`/series/${encodeURIComponent(group.seriesId)}`)} />
                ))}
              </HorizontalShelf>
            </div>
          </section>
        )}

        {!wishlistView && <section aria-labelledby={`${headingId}-insights`} className="space-y-4">
          <h2 id={`${headingId}-insights`}>Insights</h2>
          <BookHighlights rankings={authorRankings} label="Author book highlights" />
        </section>}
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
