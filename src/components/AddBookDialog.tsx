import LoadingIndicator from "@/components/LoadingIndicator";
import { useRef, useState, useEffect, useMemo, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { BookOpen, ScanBarcode, Search } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import {
  fetchBookByISBN,
  searchBooksByTitle,
  type BookTitleSearchResult,
} from "@/lib/bookLookup";
import { CreationDialogContent } from "@/components/redesign/CreationDialogContent";
import { CoverUploadField } from "@/components/redesign/CoverUploadField";
import { Dialog } from "@/components/ui/dialog";
import { BookLookupModeSwitch, BookFormTagField, mergeBookNames, RequiredBookFieldLabel } from "@/components/redesign/BookFormFields";
import { BookCover } from "@/components/reading-journal/BookCover";
import "@/components/redesign/book-form.css";
import SaveCancelBar from "@/components/SaveCancelBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBooksContext } from "@/context/BooksContext";
import { useAuth, useAuthorsContext, useUserSettings } from "@/context";
import { createWishlistItem } from "@/lib/wishlist";
import { deleteUnreferencedCover, updateBook, uploadCover } from "@/lib/books";
import { BookCopyCleanupError, saveBookCopies, type BookCopyDraft } from "@/lib/duplication";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import { getTodayLocalDate } from "@/lib/utils";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { getGenrePathLabel, isGenreRoot, mapGenreLabelsToIds } from "@/lib/genres";
import {
  formatPublicationDateInput,
  parsePublicationDateInput,
} from "@/lib/publicationDate";
import { parseVolumeNumberInput } from "@/lib/volumeNumbers";
import type {
  Book,
  BookStatus,
  BookLanguage,
  BookSource,
  BookFormat,
  BookMetadataSource,
  BookUpdate,
} from "@/types";
import type { RecommendationItem } from "@/types/recommendations";

interface FormValues {
  title: string;
  authors: string[];
  status: BookStatus;
  genres: string[];
  language: BookLanguage | "";
  format: BookFormat | "";
  source: BookSource | "";
  total_pages: string;
  current_page: string;
  publication_date: string;
  description: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
  price: string;
  purchase_url: string;
}

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  initialSeriesId?: string;
  initialVolumeNumber?: number;
  initialRecommendation?: RecommendationItem;
  initialCatalogBook?: BookTitleSearchResult;
  initiallyAddToWishlist?: boolean;
  editBook?: Book;
  duplicateBooks?: Book[];
  onCopiesSaved?: (books: Book[]) => void;
  onCancel?: () => void;
  onSaved?: (book: Book) => void;
  onWishlistSaved?: () => void;
}

type ImportMethod = "isbn" | "title";

const STATUS_OPTIONS: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

const SOURCE_OPTIONS: BookSource[] = ["Owned", "Family", "Friends", "Library"];
const WISHLIST_STATUS_VALUE = "Wishlist";
const DRAFT_SERIES = "__draft_series__";

function getInitialFormValues(initialSeriesId?: string, initialVolumeNumber?: number): FormValues {
  return {
    title: "",
    status: "To Read",
    language: "",
    format: "",
    source: "",
    authors: [],
    genres: [],
    total_pages: "",
    current_page: "",
    publication_date: "",
    description: "",
    date_started: "",
    date_finished: "",
    series_id: initialSeriesId ?? "",
    volume_number: initialVolumeNumber ? String(initialVolumeNumber) : "",
    price: "",
    purchase_url: "",
  };
}

function getBookFormValues(book: Book, duplicate: boolean): FormValues {
  return {
    title: duplicate ? `Copy of ${book.title}` : book.title,
    authors: book.authors,
    genres: book.genre_ids ?? [],
    status: book.status,
    language: book.language ?? "",
    format: book.format ?? "",
    source: book.source ?? "",
    total_pages: book.total_pages?.toString() ?? "",
    current_page: book.current_page?.toString() ?? "",
    publication_date: formatPublicationDateInput(book.publication_date),
    description: book.description ?? "",
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? "",
    series_id: book.series_id ?? "",
    volume_number: book.volume_number?.toString() ?? "",
    price: book.price?.toString() ?? "",
    purchase_url: book.purchase_url ?? "",
  };
}

function changedBookFields(book: Book, fields: BookUpdate): BookUpdate {
  return Object.fromEntries(Object.entries(fields).filter(([key, next]) => {
    const previous = book[key as keyof Book];
    return Array.isArray(next)
      ? JSON.stringify(previous ?? []) !== JSON.stringify(next)
      : (previous ?? null) !== next;
  }));
}

export default function AddBookDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  initialSeriesId,
  initialVolumeNumber,
  initialRecommendation,
  initialCatalogBook,
  initiallyAddToWishlist = false,
  editBook,
  duplicateBooks,
  onCopiesSaved,
  onCancel,
  onSaved,
  onWishlistSaved,
}: AddBookDialogProps) {
  const { addBook, reload: reloadBooks } = useBooksContext();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { genres } = useGenresContext();
  const { authors: catalogAuthors } = useAuthorsContext();
  const { series, addSeries } = useSeries();
  const [copyIndex, setCopyIndex] = useState(0);
  const copySource = duplicateBooks?.[copyIndex];
  const initialBook = editBook ?? copySource;
  const isLastCopy = !duplicateBooks || copyIndex === duplicateBooks.length - 1;
  const copyDrafts = useRef<BookCopyDraft[]>([]);
  const copyPreference = (settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_journal_entries;
  const [copyJournal, setCopyJournal] = useState(true);
  const [draftSeriesName, setDraftSeriesName] = useState("");
  const [copyCleanupFailed, setCopyCleanupFailed] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [addToWishlist, setAddToWishlist] = useState(initialBook ? initialBook.status === "Wishlist" : initiallyAddToWishlist);
  const [secondaryInformationOpen, setSecondaryInformationOpen] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [addingNewSeries, setAddingNewSeries] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [pendingSeriesSelectionId, setPendingSeriesSelectionId] = useState<string | null>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const recommendationPrefillRef = useRef<string | null>(null);
  const recommendationGenresPrefillRef = useRef<string | null>(null);
  const catalogPrefillRef = useRef<string | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [importMethod, setImportMethod] = useState<ImportMethod>("isbn");
  const [manualIsbn, setManualIsbn] = useState("");
  const [isbnStatus, setIsbnStatus] = useState<"idle" | "looking-up" | "error">("idle");
  const [isbnError, setIsbnError] = useState<string | null>(null);
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [metadataSource, setMetadataSource] = useState<BookMetadataSource | null>(null);
  const [metadataSourceUrl, setMetadataSourceUrl] = useState<string | null>(null);
  const [titleQuery, setTitleQuery] = useState("");
  const [titleSearchResults, setTitleSearchResults] = useState<BookTitleSearchResult[]>([]);
  const [titleSearchStatus, setTitleSearchStatus] = useState<"idle" | "searching" | "error">("idle");
  const [titleSearchError, setTitleSearchError] = useState<string | null>(null);
  const [titleSearchHasSearched, setTitleSearchHasSearched] = useState(false);
  const [isApplyingTitleResult, setIsApplyingTitleResult] = useState(false);
  const titleSearchRequestIdRef = useRef(0);
  const coverRequestId = useRef(0);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: initialBook ? getBookFormValues(initialBook, Boolean(copySource)) : getInitialFormValues(initialSeriesId, initialVolumeNumber),
  });

  const genreOptions = useMemo(() => {
    const selectable = genres.filter(genre => genre.is_system && !isGenreRoot(genre));
    const counts = new Map<string, number>();
    for (const genre of selectable) {
      const key = genre.name.toLocaleLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return selectable.map(genre => ({
      id: genre.id,
      label: (counts.get(genre.name.toLocaleLowerCase()) ?? 0) > 1
        ? getGenrePathLabel(genre.id, genres)
        : genre.name,
    }));
  }, [genres]);

  const status = watch("status");
  const seriesId = watch("series_id");
  const selectableSeries = series.filter((item) =>
    !item.is_wishlist_only || addToWishlist || item.id === initialSeriesId || item.id === initialBook?.series_id,
  );

  useEffect(() => {
    if (open) {
      setSecondaryInformationOpen(Boolean(initialBook));
      setAuthorQuery("");
      setGenreQuery("");
    }
  }, [initialBook, open]);

  // Revoke object URL on unmount / change
  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => () => { coverRequestId.current += 1; }, []);

  useEffect(() => {
    if (!pendingSeriesSelectionId) return;
    if (!series.some((item) => item.id === pendingSeriesSelectionId)) return;

    setValue("series_id", pendingSeriesSelectionId, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors("root");
    setPendingSeriesSelectionId(null);
  }, [pendingSeriesSelectionId, series, setValue, clearErrors]);

  useEffect(() => {
    if (!open || initialBook) return;
    setValue("series_id", initialSeriesId ?? "");
    setValue("volume_number", initialVolumeNumber ? String(initialVolumeNumber) : "");
  }, [initialBook, initialSeriesId, initialVolumeNumber, open, setValue]);

  useEffect(() => {
    if (!open || !initialBook) return;

    reset(getBookFormValues(initialBook, Boolean(copySource)));
    setAddToWishlist(initialBook.status === "Wishlist");
    setCopyJournal(true);
    setDraftSeriesName("");
    setManualIsbn("");
    setScannedIsbn(initialBook.isbn ?? null);
    setMetadataSource(initialBook.metadata_source ?? null);
    setMetadataSourceUrl(initialBook.metadata_source_url ?? null);
    setCoverFile(null);
    setCoverPreview(initialBook.cover_url ?? null);
  }, [copySource, initialBook, open, reset]);

  useEffect(() => {
    if (!open || !initialRecommendation) return;
    if (recommendationPrefillRef.current === initialRecommendation.id) return;
    recommendationPrefillRef.current = initialRecommendation.id;
    setValue("title", initialRecommendation.title);
    setValue("authors", initialRecommendation.authors);
    setValue("description", initialRecommendation.description ?? "");
    setValue("total_pages", initialRecommendation.pageCount ? String(initialRecommendation.pageCount) : "");
    setValue("publication_date", initialRecommendation.publicationDate ? formatPublicationDateInput(initialRecommendation.publicationDate) : "");
    setValue("language", (initialRecommendation.language as BookLanguage) || "");
    setScannedIsbn(initialRecommendation.isbn ?? null);
    setMetadataSource(initialRecommendation.source);
    setMetadataSourceUrl(initialRecommendation.sourceUrl);
    void applyCoverFromUrl(initialRecommendation.coverUrl, initialRecommendation.id, true);
  }, [initialRecommendation, open, setValue]);

  useEffect(() => {
    if (!open || !initialRecommendation || !genres.length) return;
    if (recommendationGenresPrefillRef.current === initialRecommendation.id) return;
    recommendationGenresPrefillRef.current = initialRecommendation.id;
    setValue("genres", mapGenreLabelsToIds(initialRecommendation.genres, genres));
  }, [initialRecommendation, genres, open, setValue]);

  useEffect(() => {
    if (!open || !initialCatalogBook || !genres.length) return;
    if (catalogPrefillRef.current === initialCatalogBook.id) return;
    catalogPrefillRef.current = initialCatalogBook.id;
    setValue("title", initialCatalogBook.title);
    setValue("authors", initialCatalogBook.authors);
    setValue("genres", mapGenreLabelsToIds(initialCatalogBook.genres ?? [], genres));
    setValue("description", initialCatalogBook.description ?? "");
    setValue("total_pages", initialCatalogBook.totalPages ? String(initialCatalogBook.totalPages) : "");
    setValue("publication_date", initialCatalogBook.publicationDate ? formatPublicationDateInput(initialCatalogBook.publicationDate) : "");
    setValue("language", (initialCatalogBook.language as BookLanguage) || "");
    setScannedIsbn(initialCatalogBook.isbn ?? null);
    setMetadataSource(initialCatalogBook.metadataSource);
    setMetadataSourceUrl(initialCatalogBook.metadataSourceUrl);
    void applyCoverFromUrl(initialCatalogBook.coverUrl, initialCatalogBook.id, true);
  }, [initialCatalogBook, genres, open, setValue]);

  function handleFileChange(file: File) {
    coverRequestId.current += 1;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function clearCoverSelection() {
    coverRequestId.current += 1;
    setCoverFile(null);
    setCoverPreview(null);
  }

  function handleImportMethodChange(value: ImportMethod) {
    setImportMethod(value);
    setShowScanner(false);
    setIsbnError(null);
    setTitleSearchError(null);
  }

  async function applyCoverFromUrl(
    coverUrl: string | undefined,
    fileLabel: string,
    clearWhenMissing: boolean,
  ) {
    if (!coverUrl) {
      if (clearWhenMissing) clearCoverSelection();
      return;
    }

    const requestId = ++coverRequestId.current;
    try {
      const res = await fetch(coverUrl);
      if (!res.ok) throw new Error("Cover request failed");
      const blob = await res.blob();
      if (requestId !== coverRequestId.current) return;
      if (blob.size <= 1000) throw new Error("Cover response was empty");

      const file = new File([blob], `cover-${fileLabel}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      clearCoverSelection();
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    } catch {
      if (clearWhenMissing && requestId === coverRequestId.current) clearCoverSelection();
    }
  }

  async function handleIsbnLookup(isbn: string) {
    setShowScanner(false);
    setIsbnStatus("looking-up");
    setIsbnError(null);
    try {
      const bookData = await fetchBookByISBN(isbn.trim());
      if (!bookData) {
        setIsbnStatus("error");
        setIsbnError(`No book found for ISBN ${isbn}`);
        return;
      }

      setScannedIsbn(isbn.trim());
      setMetadataSource(bookData.metadataSource);
      setMetadataSourceUrl(bookData.metadataSourceUrl);
      setAuthorQuery("");
      setGenreQuery("");
      setValue("title", bookData.title);
      setValue("authors", bookData.authors, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      if (bookData.totalPages) setValue("total_pages", String(bookData.totalPages));
      if (bookData.publicationDate) {
        setValue("publication_date", formatPublicationDateInput(bookData.publicationDate));
      }
      if (bookData.description) setValue("description", bookData.description);
      if (bookData.genres) {
        setValue("genres", mapGenreLabelsToIds(bookData.genres, genres), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      if (bookData.language) setValue("language", bookData.language as BookLanguage);
      if (bookData.format) setValue("format", bookData.format as BookFormat);

      // Download cover image as a File for the existing upload flow
      if (bookData.coverUrl) {
        await applyCoverFromUrl(bookData.coverUrl, isbn.trim(), false);
      }

      setIsbnStatus("idle");
    } catch {
      setIsbnStatus("error");
      setIsbnError("Failed to look up book. Please try again or enter details manually.");
    }
  }

  async function handleTitleSearch() {
    const query = titleQuery.trim();
    if (!query || titleSearchStatus === "searching" || isApplyingTitleResult) return;

    const requestId = ++titleSearchRequestIdRef.current;
    setTitleSearchResults([]);
    setTitleSearchError(null);
    setTitleSearchHasSearched(true);
    setTitleSearchStatus("searching");

    try {
      const results = await searchBooksByTitle(query);
      if (requestId !== titleSearchRequestIdRef.current) return;
      setTitleSearchResults(results);
      setTitleSearchStatus("idle");
    } catch {
      if (requestId !== titleSearchRequestIdRef.current) return;
      setTitleSearchStatus("error");
      setTitleSearchError("Failed to search books. Please try again or enter details manually.");
    }
  }

  async function handleTitleResultSelect(result: BookTitleSearchResult) {
    titleSearchRequestIdRef.current += 1;
    setIsApplyingTitleResult(true);
    setTitleSearchResults([]);
    setTitleSearchHasSearched(false);
    setTitleSearchError(null);

    setAuthorQuery("");
    setGenreQuery("");
    setValue("title", result.title);
    setValue("authors", result.authors, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue("total_pages", result.totalPages ? String(result.totalPages) : "");
    setValue(
      "publication_date",
      result.publicationDate ? formatPublicationDateInput(result.publicationDate) : "",
    );
    setValue("description", result.description ?? "");
    setValue("genres", mapGenreLabelsToIds(result.genres ?? [], genres), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue("language", (result.language as BookLanguage) || "");
    setScannedIsbn(result.isbn ?? null);
    setManualIsbn("");
    setMetadataSource(result.metadataSource);
    setMetadataSourceUrl(result.metadataSourceUrl);

    await applyCoverFromUrl(result.coverUrl, "google-books", true);
    setIsApplyingTitleResult(false);
  }

  async function handleAddNewSeries() {
    const trimmedSeriesName = newSeriesName.trim();
    if (!trimmedSeriesName || isCreatingSeries) return;

    if (copySource) {
      setDraftSeriesName(trimmedSeriesName);
      setValue("series_id", DRAFT_SERIES);
      setNewSeriesName("");
      setAddingNewSeries(false);
      return;
    }

    setIsCreatingSeries(true);
    try {
      const created = await addSeries(addToWishlist
        ? { name: trimmedSeriesName, is_wishlist_only: true }
        : trimmedSeriesName);
      setPendingSeriesSelectionId(created.id);
      setNewSeriesName("");
      setAddingNewSeries(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create series. Please try again.";
      setError("root", { message });
    } finally {
      setIsCreatingSeries(false);
    }
  }

  function addAuthors() {
    if (!authorQuery.trim()) return;
    setValue("authors", mergeBookNames(watch("authors"), authorQuery), { shouldDirty: true });
    setAuthorQuery("");
    clearErrors("authors");
  }

  function addGenres() {
    const query = genreQuery.trim().toLocaleLowerCase();
    if (!query) return true;

    const genre = genreOptions.find(option => option.label.toLocaleLowerCase() === query);
    if (!genre) {
      setError("genres", { message: "Select one of the suggested genres." });
      return false;
    }

    setValue("genres", [...new Set([...watch("genres"), genre.id])], { shouldDirty: true });
    setGenreQuery("");
    clearErrors("genres");
    return true;
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || copyCleanupFailed || isCreatingSeries || isApplyingTitleResult || isbnStatus === "looking-up" || !addGenres()) return;
    addAuthors();
    void handleSubmit(onSubmit)(event);
  }

  async function onSubmit(values: FormValues) {
    try {
      const authors = mergeBookNames(values.authors, "");
      if (authors.length === 0) {
        setError("authors", { message: "At least one author is required" });
        return;
      }
      const parsedPublicationDate = parsePublicationDateInput(values.publication_date);
      if (values.publication_date.trim() && !parsedPublicationDate) {
        setSecondaryInformationOpen(true);
        setError("publication_date", {
          message: "Use a four-digit year, like 2020.",
        });
        return;
      }
      const parsedVolumeNumber = values.volume_number
        ? parseVolumeNumberInput(values.volume_number)
        : null;
      if (values.volume_number && parsedVolumeNumber === null) {
        setError("volume_number", {
          message: "Use a positive number with at most two decimal places.",
        });
        return;
      }
      const parsedPrice = values.price.trim() ? Number(values.price) : null;
      const isbn = scannedIsbn?.trim() || null;
      if (addToWishlist && values.price.trim() && (!Number.isFinite(parsedPrice) || parsedPrice! < 0)) {
        setSecondaryInformationOpen(true);
        setError("price", { message: "Enter a price of zero or more." });
        return;
      }
      if (addToWishlist && values.purchase_url.trim()) {
        try {
          const url = new URL(values.purchase_url.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        } catch {
          setSecondaryInformationOpen(true);
          setError("purchase_url", { message: "Enter a valid web link, including https://." });
          return;
        }
      }
      if (initialBook) {
        if (!user) throw new Error("Not authenticated");
        const status = addToWishlist ? "Wishlist" : values.status;
        const statusChanged = status !== initialBook.status;
        const fields = {
          title: values.title === initialBook.title ? initialBook.title : values.title.trim(),
          authors,
          genre_ids: values.genres,
          language: values.language || null,
          format: values.format || null,
          source: values.source || null,
          status,
          total_pages: values.total_pages ? Number(values.total_pages) : null,
          current_page: values.current_page ? Number(values.current_page) : null,
          date_started: values.date_started || (editBook && statusChanged && status === "Reading" ? getTodayLocalDate() : null),
          date_finished: values.date_finished || (editBook && statusChanged && status === "Finished" ? getTodayLocalDate() : null),
          publication_date: initialBook.publication_date && values.publication_date === formatPublicationDateInput(initialBook.publication_date)
            ? initialBook.publication_date : parsedPublicationDate?.date ?? null,
          description: values.description === (initialBook.description ?? "") ? initialBook.description ?? null : values.description.trim() || null,
          isbn,
          metadata_source: metadataSource,
          metadata_source_url: metadataSourceUrl,
          series_id: values.series_id === DRAFT_SERIES ? null : values.series_id || null,
          volume_number: parsedVolumeNumber,
          price: addToWishlist ? parsedPrice : initialBook.price ?? null,
          purchase_url: addToWishlist ? values.purchase_url.trim() || null : initialBook.purchase_url ?? null,
          cover_url: coverFile ? initialBook.cover_url ?? null : coverPreview,
        } satisfies BookUpdate;

        if (copySource) {
          const draft: BookCopyDraft = {
            sourceId: copySource.id,
            fields: {
              ...fields,
              rating: copySource.status === "Wishlist" ? null : copySource.rating ?? null,
              is_favorite: copySource.status !== "Wishlist" && copySource.is_favorite,
            },
            coverFile: coverFile ?? undefined,
            newSeriesName: values.series_id === DRAFT_SERIES ? draftSeriesName : undefined,
            copyJournalEntries: copyPreference === "ask" ? copyJournal : copyPreference === "always",
          };
          if (!isLastCopy) {
            copyDrafts.current.push(draft);
            titleSearchRequestIdRef.current += 1;
            setTitleQuery("");
            setTitleSearchResults([]);
            setTitleSearchStatus("idle");
            setTitleSearchHasSearched(false);
            setTitleSearchError(null);
            setIsbnError(null);
            setIsbnStatus("idle");
            setShowScanner(false);
            setAddingNewSeries(false);
            setNewSeriesName("");
            setCopyIndex(copyIndex + 1);
            return;
          }
          const copies = await saveBookCopies(user.id, [...copyDrafts.current, draft]);
          await reloadBooks();
          if (onCopiesSaved) onCopiesSaved(copies);
          else onSaved?.(copies[0]);
        } else {
          const patch = changedBookFields(initialBook, fields);
          let uploadedCover: string | undefined;
          let updated = initialBook;
          try {
            if (coverFile) {
              uploadedCover = await uploadCover(user.id, crypto.randomUUID(), coverFile);
              patch.cover_url = uploadedCover;
            }
            if (Object.keys(patch).length) updated = await updateBook(initialBook.id, patch);
          } catch (error) {
            if (uploadedCover) await deleteUnreferencedCover(user.id, uploadedCover).catch(() => {});
            throw error;
          }
          await reloadBooks();
          onSaved?.(updated);
        }
        onOpenChange(false);
        return;
      }
      if (addToWishlist) {
        if (!user) throw new Error("Not authenticated");
        const wishlistInput = {
          title: values.title, authors, genre_ids: values.genres,
          genres: values.genres.map((id) => genres.find((genre) => genre.id === id)?.name ?? "").filter(Boolean),
          language: (values.language as BookLanguage) || null, format: (values.format as BookFormat) || null,
          total_pages: values.total_pages ? Number(values.total_pages) : null,
          publication_date: parsedPublicationDate?.date ?? null, description: values.description.trim() || null,
          isbn, metadata_source: metadataSource || null, metadata_source_url: metadataSourceUrl || null,
          series_id: values.series_id || null, volume_number: parsedVolumeNumber,
          price: parsedPrice, purchase_url: values.purchase_url.trim() || null,
          cover_url: coverFile ? null : coverPreview,
        };
        try {
          await createWishlistItem(user.id, wishlistInput, coverFile ?? undefined);
        } catch (error) {
          if (error && typeof error === "object" && "item" in error) { await reloadBooks(); onWishlistSaved?.(); }
          throw error;
        }
        await reloadBooks();
        onWishlistSaved?.();
        reset(getInitialFormValues(initialSeriesId, initialVolumeNumber));
        setAddToWishlist(false);
        onOpenChange(false);
        return;
      }
      const result = await addBook(
        {
          title: values.title,
          authors,
          status: values.status,
          genre_ids: values.genres,
          language: (values.language as BookLanguage) || undefined,
          format: (values.format as BookFormat) || undefined,
          source: (values.source as BookSource) || undefined,
          total_pages: values.total_pages ? Number(values.total_pages) : undefined,
          current_page: values.current_page ? Number(values.current_page) : undefined,
          publication_date: parsedPublicationDate?.date,
          description: values.description.trim() || undefined,
          date_started: values.date_started || undefined,
          date_finished: values.date_finished || undefined,
          series_id: values.series_id || undefined,
          volume_number: parsedVolumeNumber ?? undefined,
          isbn: isbn ?? undefined,
          metadata_source: metadataSource || undefined,
          metadata_source_url: metadataSourceUrl || undefined,
          is_favorite: false,
        },
        coverFile ?? undefined
      );

      if (result.warning) {
        onSaved?.(result.book);
        reset(getInitialFormValues(initialSeriesId, initialVolumeNumber));
        setCoverFile(null);
        setCoverPreview(null);
        setShowScanner(false);
        setImportMethod("isbn");
        setManualIsbn("");
        setIsbnStatus("idle");
        setIsbnError(null);
        setScannedIsbn(null);
        setMetadataSource(null);
        setMetadataSourceUrl(null);
        titleSearchRequestIdRef.current += 1;
        setTitleQuery("");
        setTitleSearchResults([]);
        setTitleSearchStatus("idle");
        setTitleSearchError(null);
        setTitleSearchHasSearched(false);
        setIsApplyingTitleResult(false);
        setAddingNewSeries(false);
        setNewSeriesName("");
        setIsCreatingSeries(false);
        setPendingSeriesSelectionId(null);
        setError("root", { message: result.warning });
        return;
      }

      onSaved?.(result.book);
      reset(getInitialFormValues(initialSeriesId, initialVolumeNumber));
      setCoverFile(null);
      setCoverPreview(null);
      setShowScanner(false);
      setImportMethod("isbn");
      setManualIsbn("");
      setIsbnStatus("idle");
      setIsbnError(null);
      setScannedIsbn(null);
      setMetadataSource(null);
      setMetadataSourceUrl(null);
      titleSearchRequestIdRef.current += 1;
      setTitleQuery("");
      setTitleSearchResults([]);
      setTitleSearchStatus("idle");
      setTitleSearchError(null);
      setTitleSearchHasSearched(false);
      setIsApplyingTitleResult(false);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof BookCopyCleanupError) {
        setCopyCleanupFailed(true);
        await reloadBooks();
      }
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : editBook ? "Failed to save changes" : "Failed to add book";
      setError("root", { message });
    }
  }

  let description = "Find a book or fill in the details yourself.";
  if (editBook) description = "Update the book details.";
  if (copySource) {
    description = duplicateBooks && duplicateBooks.length > 1
      ? `Review copy ${copyIndex + 1} of ${duplicateBooks.length}. Your copies are added when you save the last one.`
      : "Review the details before adding this copy.";
  }

  const showDateStarted = ["Reading", "Paused", "Finished", "DNF"].includes(status) || Boolean(initialBook?.date_started);
  const showDateFinished = ["Finished", "DNF"].includes(status) || Boolean(initialBook?.date_finished);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (isSubmitting || isCreatingSeries) return;
      titleSearchRequestIdRef.current += 1;
      reset({
        ...getInitialFormValues(initialSeriesId, initialVolumeNumber),
      });
      setCoverFile(null);
      setCoverPreview(null);
      setShowScanner(false);
      setImportMethod("isbn");
      setManualIsbn("");
      setIsbnStatus("idle");
      setIsbnError(null);
      setScannedIsbn(null);
      setMetadataSource(null);
      setMetadataSourceUrl(null);
      setTitleQuery("");
      setTitleSearchResults([]);
      setTitleSearchStatus("idle");
      setTitleSearchError(null);
      setTitleSearchHasSearched(false);
      setIsApplyingTitleResult(false);
      setAddingNewSeries(false);
      setNewSeriesName("");
      setIsCreatingSeries(false);
      setPendingSeriesSelectionId(null);
      onCancel?.();
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreationDialogContent
        className="rj-add-book-dialog"
        title={editBook ? "Edit book" : "Add book"}
        description={description}
        icon={BookOpen}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={submitForm} className="rj-book-form">
          <ScrollArea key={copyIndex} className="rj-creation-book-scroll">
            <div className="rj-creation-book-fields rj-book-form-fields">
              {!initialBook && (
                <section className="rj-book-lookup" aria-label="Find book details">
                  <BookLookupModeSwitch
                    mode={importMethod}
                    onChange={handleImportMethodChange}
                    disabled={isbnStatus === "looking-up" || titleSearchStatus === "searching" || isApplyingTitleResult}
                  />

                  {importMethod === "isbn" ? (
                    <>
                      {/* ISBN Scanner */}
                      {showScanner ? (
                        <BarcodeScanner
                          onScan={handleIsbnLookup}
                          onClose={() => setShowScanner(false)}
                        />
                      ) : (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rj-lookup-scan"
                            onClick={() => { setShowScanner(true); setIsbnError(null); }}
                            disabled={isbnStatus === "looking-up"}
                          >
                            <ScanBarcode className="h-4 w-4" />
                            Scan ISBN barcode
                          </Button>
                          <div className="rj-lookup-query">
                            <Input
                              aria-label="ISBN to look up"
                              type="search"
                              placeholder="Enter ISBN"
                              value={manualIsbn}
                              onChange={(e) => setManualIsbn(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (manualIsbn.trim()) handleIsbnLookup(manualIsbn);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              disabled={!manualIsbn.trim() || isbnStatus === "looking-up"}
                              onClick={() => handleIsbnLookup(manualIsbn)}
                            >
                              <Search aria-hidden="true" />Look up
                            </Button>
                          </div>
                        </div>
                      )}

                      {isbnStatus === "looking-up" && (
                        <LoadingIndicator variant="inline" className="flex justify-center" label="Looking up book…" />
                      )}

                      {isbnError && (
                        <p className="text-sm text-destructive text-center">{isbnError}</p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="rj-lookup-query">
                        <Input
                          id="title-search"
                          type="search"
                          aria-label="Book title to search"
                          placeholder="Enter a book title"
                          value={titleQuery}
                          onChange={(e) => setTitleQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleTitleSearch();
                            }
                          }}
                          disabled={isApplyingTitleResult}
                        />
                        <Button
                          type="button"
                          disabled={!titleQuery.trim() || titleSearchStatus === "searching" || isApplyingTitleResult}
                          onClick={() => void handleTitleSearch()}
                        >
                          <Search aria-hidden="true" />Search books
                        </Button>
                      </div>

                      {titleSearchStatus === "searching" && (
                        <LoadingIndicator variant="inline" className="flex justify-center" label="Searching book catalogs…" />
                      )}

                      {isApplyingTitleResult && <LoadingIndicator variant="inline" label="Loading book details…" />}

                      {titleSearchError && (
                        <p className="text-sm text-destructive text-center">{titleSearchError}</p>
                      )}

                      {titleSearchHasSearched &&
                        titleSearchStatus === "idle" &&
                        titleSearchResults.length === 0 && (
                          <p className="text-sm text-center text-muted-foreground">
                            No matching editions found.
                          </p>
                        )}

                      {titleSearchResults.length > 0 && (
                        <>
                          <p className="rj-book-form-hint">Using a result replaces the book metadata below. Status, source and series stay as you set them.</p>
                          <ul className="rj-lookup-results" aria-label="Book search results">
                            {titleSearchResults.map(result => (
                              <li key={result.id}>
                                <BookCover src={result.coverUrl} title={result.title} decorative />
                                <div>
                                  <strong>{result.title}</strong>
                                  <p>{result.authors.join(", ")}</p>
                                  {(result.publicationDate || result.isbn) && (
                                    <small>{[result.publicationDate?.slice(0, 4), result.isbn].filter(Boolean).join(" · ")}</small>
                                  )}
                                  <Button type="button" variant="outline" aria-label={`Use ${result.title}`}
                                    onClick={() => void handleTitleResultSelect(result)} disabled={isApplyingTitleResult}>
                                    Use these details
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}
              <div className="rj-book-form-primary">
                <div className="rj-book-cover-editor">
                  <CoverUploadField id="cover-upload" label="Book cover" shape="cover" preview={coverPreview}
                    fileName={coverFile?.name} onFileChange={handleFileChange} />
                  {coverPreview && <Button type="button" variant="ghost" onClick={clearCoverSelection}>Remove cover</Button>}
                </div>
                <div className="rj-book-form-identity">
                  <div className="rj-book-form-field">
                    <RequiredBookFieldLabel htmlFor="title" text="Title" />
                    <Input id="title" {...register("title", { validate: value => Boolean(value.trim()) || "Title is required" })} aria-required="true"
                      aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "add-book-title-error" : undefined} />
                    {errors.title && <p id="add-book-title-error" className="rj-book-form-error">{errors.title.message}</p>}
                  </div>

                  <BookFormTagField kind="authors" query={authorQuery}
                    selected={mergeBookNames(watch("authors"), "").map(label => ({ id: label, label }))}
                    options={Array.from(new Set(catalogAuthors.map(author => author.name)))}
                    onQueryChange={query => { setAuthorQuery(query); clearErrors("authors"); }}
                    onAdd={addAuthors}
                    onRemove={name => setValue("authors", mergeBookNames(watch("authors"), "").filter(author => author !== name), { shouldDirty: true })}
                    error={errors.authors?.message} />

                  <BookFormTagField kind="genres" query={genreQuery} catalogOnly
                    selected={watch("genres").map(id => genreOptions.find(option => option.id === id)
                      ?? { id, label: genres.find(genre => genre.id === id)?.name ?? "Unavailable genre" })}
                    options={genreOptions.map(option => option.label)}
                    onQueryChange={query => { setGenreQuery(query); clearErrors("genres"); }}
                    onAdd={addGenres}
                    onRemove={id => setValue("genres", watch("genres").filter(genreId => genreId !== id), { shouldDirty: true })}
                    error={errors.genres?.message} />
                </div>
              </div>

              <div className="rj-book-form-grid">
                <div className="rj-book-form-field">
                  <Label htmlFor="add-book-status">Reading status</Label>
                  <select id="add-book-status" value={addToWishlist ? WISHLIST_STATUS_VALUE : status}
                    onChange={event => {
                      const nextStatus = event.currentTarget.value as BookStatus;
                      setAddToWishlist(nextStatus === WISHLIST_STATUS_VALUE);
                      if (nextStatus !== WISHLIST_STATUS_VALUE) setValue("status", nextStatus, { shouldDirty: true });
                    }}>
                    <option value={WISHLIST_STATUS_VALUE}>Wishlist</option>
                    {STATUS_OPTIONS.map(option => <option key={option}>{option}</option>)}
                    {initialBook?.status === "Paused" && <option>Paused</option>}
                  </select>
                </div>
                <div className="rj-book-form-field">
                  <Label htmlFor="add-book-language">Language</Label>
                  <select id="add-book-language" {...register("language")}>
                    <option value="">Not set</option>
                    {["German", "Spanish", "English"].map(option => <option key={option}>{option}</option>)}
                  </select>
                </div>
                <div className="rj-book-form-field">
                  <Label htmlFor="total_pages">Total pages</Label>
                  <Input
                    id="total_pages"
                    type="number"
                    min={1}
                    {...register("total_pages")}
                  />
                </div>
                {!addToWishlist && (status === "Reading" || initialBook && ["Paused", "Finished", "DNF"].includes(status)) && (
                  <div className="rj-book-form-field">
                    <Label htmlFor="current_page">Current page</Label>
                    <Input
                      id="current_page"
                      type="number"
                      min={0}
                      {...register("current_page")}
                    />
                  </div>
                )}

                {/* Series */}
                <div className="rj-book-form-field">
                  <Label htmlFor="add-book-series">Series</Label>
                  <select id="add-book-series" value={seriesId || ""} onChange={event => {
                    const nextSeries = event.currentTarget.value;
                    if (nextSeries === "__new__") setAddingNewSeries(true);
                    else {
                      setValue("series_id", nextSeries, { shouldDirty: true });
                      if (!nextSeries) setValue("volume_number", "", { shouldDirty: true });
                    }
                  }}>
                    <option value="">None</option>
                    {selectableSeries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    {draftSeriesName && <option value={DRAFT_SERIES}>{draftSeriesName}</option>}
                    <option value="__new__">+ Add new series…</option>
                  </select>
                  {addingNewSeries && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Input
                        placeholder="Series name"
                        value={newSeriesName}
                        onChange={(e) => setNewSeriesName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNewSeries())}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddNewSeries}
                        disabled={isCreatingSeries || !newSeriesName.trim()}
                      >
                        {isCreatingSeries ? "Adding..." : "Add"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isCreatingSeries}
                        onClick={() => setAddingNewSeries(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Volume number (conditional) */}
                {seriesId && seriesId !== "__new__" && (
                  <div className="rj-book-form-field">
                    <Label htmlFor="volume_number">Volume number</Label>
                    <Input
                      id="volume_number"
                      type="number"
                      min={0.01}
                      step="0.01"
                      {...register("volume_number")}
                    />
                    {errors.volume_number && (
                      <p className="text-xs text-destructive">{errors.volume_number.message}</p>
                    )}
                  </div>
                )}

                {/* Dates (conditional) */}
                {!addToWishlist && showDateStarted && (
                  <div className="rj-book-form-field">
                    <Label htmlFor="date_started">Date started</Label>
                    <Input id="date_started" type="date" {...register("date_started")} />
                  </div>
                )}
                {!addToWishlist && showDateFinished && (
                  <div className="rj-book-form-field">
                    <Label htmlFor="date_finished">Date finished</Label>
                    <Input id="date_finished" type="date" {...register("date_finished")} />
                  </div>
                )}
              </div>

              <details className="rj-book-form-details" open={secondaryInformationOpen}
                onToggle={event => setSecondaryInformationOpen(event.currentTarget.open)}>
                <summary>Secondary Information <span>Optional details</span></summary>
                {secondaryInformationOpen && (
                  <div className="rj-book-form-secondary">
                    <div className="rj-book-form-grid">
                      <div className="rj-book-form-field">
                        <Label htmlFor="publication_date">Publication year</Label>
                        <Input
                          id="publication_date"
                          placeholder="YYYY"
                          inputMode="numeric"
                          maxLength={4}
                          aria-invalid={!!errors.publication_date}
                          {...register("publication_date", {
                            onChange: () => clearErrors("publication_date"),
                          })}
                        />
                        {errors.publication_date && (
                          <p className="text-xs text-destructive">
                            {errors.publication_date.message}
                          </p>
                        )}
                      </div>

                      <div className="rj-book-form-field">
                        <Label htmlFor="add-book-format">Format</Label>
                        <select id="add-book-format" {...register("format")}>
                          <option value="">Not set</option>
                          {["eBook", "Audiobook", "Paperback", "Hardcover"].map(option => <option key={option}>{option}</option>)}
                        </select>
                      </div>

                      <div className="rj-book-form-field">
                        <Label htmlFor="add-book-source">Source</Label>
                        <select id="add-book-source" {...register("source")}>
                          <option value="">Not set</option>
                          {SOURCE_OPTIONS.map(option => <option key={option}>{option}</option>)}
                        </select>
                      </div>

                      <div className="rj-book-form-field">
                        <Label htmlFor="add-book-isbn">ISBN</Label>
                        <Input
                          id="add-book-isbn"
                          value={scannedIsbn ?? ""}
                          placeholder="Enter, scan or look up an ISBN"
                          onChange={event => {
                            setScannedIsbn(event.currentTarget.value);
                            setMetadataSource(null);
                            setMetadataSourceUrl(null);
                          }}
                        />
                      </div>

                      {addToWishlist && <>
                        <div className="rj-book-form-field">
                          <Label htmlFor="price">Price</Label>
                          <Input id="price" type="number" min="0" step="0.01" inputMode="decimal" {...register("price")} />
                          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                        </div>
                        <div className="rj-book-form-field">
                          <Label htmlFor="purchase_url">Purchase link</Label>
                          <Input id="purchase_url" type="url" placeholder="https://…" {...register("purchase_url")} />
                          {errors.purchase_url && <p className="text-xs text-destructive">{errors.purchase_url.message}</p>}
                        </div>
                      </>}
                    </div>

                  </div>
                )}
              </details>

              <div className="rj-book-form-field">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={5} {...register("description")} />
              </div>

              {copySource && copyPreference === "ask" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={copyJournal} onChange={event => setCopyJournal(event.currentTarget.checked)} />
                  Copy journal entries
                </label>
              )}

              {/* Root error */}
              {errors.root && (
                <p className="rj-book-form-error" role="alert">{errors.root.message}</p>
              )}
            </div>
          </ScrollArea>

          <SaveCancelBar
            mode="creation-dialog"
            onCancel={() => handleOpenChange(false)}
            saving={isSubmitting}
            cancelDisabled={isCreatingSeries}
            saveDisabled={copyCleanupFailed || isCreatingSeries || isApplyingTitleResult || isbnStatus === "looking-up"}
            saveLabel={editBook ? "Save changes" : isLastCopy ? "Add book" : "Next book"}
          />
        </form>
      </CreationDialogContent>
    </Dialog>
  );
}
