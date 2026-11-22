import LoadingIndicator from "@/components/LoadingIndicator";
import { useRef, useState, useEffect, useMemo, type FormEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { BookOpen, ImagePlus, ScanBarcode, Search } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import {
  fetchBookByISBN,
  searchBooksByTitle,
  type BookTitleSearchResult,
} from "@/lib/bookLookup";
import { CreationDialogContent } from "@/components/redesign/CreationDialogContent";
import { Dialog } from "@/components/ui/dialog";
import { BookLookupModeSwitch, BookFormTagField, mergeBookNames } from "@/components/redesign/BookFormFields";
import { BookCover } from "@/components/reading-journal/BookCover";
import "@/components/redesign/book-form.css";
import SaveCancelBar from "@/components/SaveCancelBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { useAuth, useAuthorsContext } from "@/context";
import { createWishlistItem, updateWishlistItem } from "@/lib/wishlist";
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
  initialBook?: Book;
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

function getInitialFormValues(initialSeriesId?: string, initialVolumeNumber?: number): Partial<FormValues> {
  return {
    status: "To Read",
    authors: [],
    genres: [],
    series_id: initialSeriesId ?? "",
    volume_number: initialVolumeNumber ? String(initialVolumeNumber) : "",
    price: "",
    purchase_url: "",
  };
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
  initialBook,
  onSaved,
  onWishlistSaved,
}: AddBookDialogProps) {
  const { addBook, reload: reloadBooks } = useBooksContext();
  const { user } = useAuth();
  const { genres } = useGenresContext();
  const { authors: catalogAuthors } = useAuthorsContext();
  const { series, addSeries } = useSeries();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [addToWishlist, setAddToWishlist] = useState(initiallyAddToWishlist);
  const [secondaryInformationOpen, setSecondaryInformationOpen] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [addingNewSeries, setAddingNewSeries] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [pendingSeriesSelectionId, setPendingSeriesSelectionId] = useState<string | null>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: getInitialFormValues(initialSeriesId, initialVolumeNumber),
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
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

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
    if (!open) return;
    setValue("series_id", initialSeriesId ?? "");
    setValue("volume_number", initialVolumeNumber ? String(initialVolumeNumber) : "");
  }, [initialSeriesId, initialVolumeNumber, open, setValue]);

  useEffect(() => {
    if (!open || !initialBook) return;

    reset({
      ...getInitialFormValues(),
      title: initialBook.title,
      authors: initialBook.authors ?? [],
      genres: initialBook.genre_ids ?? [],
      language: initialBook.language ?? "",
      format: initialBook.format ?? "",
      total_pages: initialBook.total_pages ? String(initialBook.total_pages) : "",
      publication_date: initialBook.publication_date ? formatPublicationDateInput(initialBook.publication_date) : "",
      description: initialBook.description ?? "",
      series_id: initialBook.series_id ?? "",
      volume_number: initialBook.volume_number != null ? String(initialBook.volume_number) : "",
      price: initialBook.price != null ? String(initialBook.price) : "",
      purchase_url: initialBook.purchase_url ?? "",
    });
    setAddToWishlist(true);
    setScannedIsbn(initialBook.isbn ?? null);
    setMetadataSource(initialBook.metadata_source ?? null);
    setMetadataSourceUrl(initialBook.metadata_source_url ?? null);
    setCoverFile(null);
    setCoverPreview(initialBook.cover_url ?? null);
  }, [initialBook, open, reset]);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function clearCoverSelection() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

    try {
      const res = await fetch(coverUrl);
      if (!res.ok) throw new Error("Cover request failed");
      const blob = await res.blob();
      if (blob.size <= 1000) throw new Error("Cover response was empty");

      const file = new File([blob], `cover-${fileLabel}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      clearCoverSelection();
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    } catch {
      if (clearWhenMissing) clearCoverSelection();
    }
  }

  async function handleIsbnLookup(isbn: string) {
    setShowScanner(false);
    setIsbnStatus("looking-up");
    setIsbnError(null);
    setMetadataSource(null);
    setMetadataSourceUrl(null);

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
      setError("genres", { message: "Choose a genre from the catalog." });
      return false;
    }

    setValue("genres", [...new Set([...watch("genres"), genre.id])], { shouldDirty: true });
    setGenreQuery("");
    clearErrors("genres");
    return true;
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !addGenres()) return;
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
      if (initialBook || addToWishlist) {
        if (!user) throw new Error("Not authenticated");
        const wishlistInput = {
          title: values.title, authors, genre_ids: values.genres,
          genres: values.genres.map((id) => genres.find((genre) => genre.id === id)?.name ?? "").filter(Boolean),
          language: (values.language as BookLanguage) || null, format: (values.format as BookFormat) || null,
          total_pages: values.total_pages ? Number(values.total_pages) : null,
          publication_date: parsedPublicationDate?.date ?? null, description: values.description.trim() || null,
          isbn: scannedIsbn || null, metadata_source: metadataSource || null, metadata_source_url: metadataSourceUrl || null,
          series_id: values.series_id || null, volume_number: parsedVolumeNumber,
          price: parsedPrice, purchase_url: values.purchase_url.trim() || null,
          cover_url: coverFile ? initialBook?.cover_url ?? null : coverPreview,
        };
        try {
          if (initialBook) await updateWishlistItem(initialBook, wishlistInput, coverFile ?? undefined);
          else await createWishlistItem(user.id, wishlistInput, coverFile ?? undefined);
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
          isbn: scannedIsbn || undefined,
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
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to add book";
      setError("root", { message });
    }
  }

  const showDateStarted = ["Reading", "Finished", "DNF"].includes(status);
  const showDateFinished = ["Finished", "DNF"].includes(status);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
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
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreationDialogContent
        title={initialBook ? "Edit Wishlist Item" : "Add Book"}
        description="Find a book or fill in the details yourself."
        icon={BookOpen}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={submitForm} className="rj-book-form">
          <ScrollArea className="rj-creation-book-scroll">
            <div className="rj-creation-book-fields rj-book-form-fields">
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
              <p className="rj-book-form-hint">Title and author are required.</p>

              <div className="rj-book-form-primary">
                <div className="rj-book-cover-editor">
                  <label className="rj-book-cover-upload">
                    <input type="file" accept="image/*" className="sr-only" aria-label="Book cover" ref={fileInputRef} onChange={handleFileChange} />
                    <BookCover src={coverPreview} title={watch("title") || "New book"} decorative />
                    <span><ImagePlus size={18} aria-hidden="true" />{coverPreview ? "Change cover" : "Add cover"}</span>
                  </label>
                  {coverPreview && <Button type="button" variant="ghost" onClick={clearCoverSelection}>Remove cover</Button>}
                  {coverFile && <p className="rj-book-form-hint truncate">{coverFile.name}</p>}
                </div>
                <div className="rj-book-form-identity">
                  <div className="rj-book-form-field">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" {...register("title", { required: "Title is required" })} aria-required="true"
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
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={addToWishlist ? WISHLIST_STATUS_VALUE : field.value}
                          disabled={Boolean(initialBook)}
                          onValueChange={(value) => {
                            if (value === WISHLIST_STATUS_VALUE) {
                              setAddToWishlist(true);
                              return;
                            }
                            setAddToWishlist(false);
                            field.onChange(value as BookStatus);
                          }}
                        >
                          <SelectTrigger id="add-book-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={WISHLIST_STATUS_VALUE}>Wishlist</SelectItem>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                </div>
                <div className="rj-book-form-field">
                  <Label htmlFor="add-book-language">Language</Label>
                  <Controller
                    name="language"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger id="add-book-language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not set</SelectItem>
                          {(["German", "Spanish", "English"] as BookLanguage[]).map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="rj-book-form-field">
                  <Label htmlFor="total_pages">Total pages</Label>
                  <Input
                    id="total_pages"
                    type="number"
                    min={1}
                    {...register("total_pages")}
                    aria-describedby="add-book-pages-hint"
                  />
                  <p id="add-book-pages-hint" className="rj-book-form-hint">Leave blank if unknown.</p>
                </div>
                {/* Series */}
                <div className="rj-book-form-field">
                  <Label htmlFor="add-book-series">Series</Label>
                  <Controller
                    name="series_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) => {
                          if (v === "__new__") {
                            setAddingNewSeries(true);
                          } else if (v === "__none__") {
                            field.onChange("");
                          } else {
                            field.onChange(v);
                          }
                        }}
                      >
                        <SelectTrigger id="add-book-series">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {selectableSeries.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__">+ Add new series…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
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
                {/* Current progress (Reading only) */}
                {!addToWishlist && status === "Reading" && (
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
                        <Controller
                          name="format"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                              <SelectTrigger id="add-book-format">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not set</SelectItem>
                                {(["eBook", "Audiobook", "Paperback", "Hardcover"] as BookFormat[]).map(
                                  (f) => (
                                    <SelectItem key={f} value={f}>
                                      {f}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="rj-book-form-field">
                        <Label htmlFor="add-book-source">Source</Label>
                        <Controller
                          name="source"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                              <SelectTrigger id="add-book-source">
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not set</SelectItem>
                                {SOURCE_OPTIONS.map((source) => (
                                  <SelectItem key={source} value={source}>
                                    {source}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="rj-book-form-field">
                        <Label htmlFor="add-book-isbn">ISBN</Label>
                        <Input id="add-book-isbn" value={scannedIsbn ?? manualIsbn} readOnly placeholder="Scanned or looked up ISBN" />
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
            saveLabel={initialBook ? "Save Changes" : "Add Book"}
          />
        </form>
      </CreationDialogContent>
    </Dialog>
  );
}
