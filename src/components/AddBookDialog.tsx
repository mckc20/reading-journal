import { useRef, useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { ImagePlus, ScanBarcode, Loader2 } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import AuthorMultiSelect from "@/components/AuthorMultiSelect";
import BarcodeScanner from "@/components/BarcodeScanner";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import {
  fetchBookByISBN,
  searchBooksByTitle,
  type BookTitleSearchResult,
} from "@/lib/bookLookup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuth } from "@/context";
import { createWishlistItem } from "@/lib/wishlist";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { mapGenreLabelsToIds } from "@/lib/genres";
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
  initialSeriesId?: string;
  initialVolumeNumber?: number;
  initialRecommendation?: RecommendationItem;
  initialCatalogBook?: BookTitleSearchResult;
  initiallyAddToWishlist?: boolean;
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
  initialSeriesId,
  initialVolumeNumber,
  initialRecommendation,
  initialCatalogBook,
  initiallyAddToWishlist = false,
  onSaved,
  onWishlistSaved,
}: AddBookDialogProps) {
  const { addBook } = useBooksContext();
  const { user } = useAuth();
  const { genres } = useGenresContext();
  const { series, addSeries } = useSeries();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [addToWishlist, setAddToWishlist] = useState(initiallyAddToWishlist);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [addingNewSeries, setAddingNewSeries] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [pendingSeriesSelectionId, setPendingSeriesSelectionId] = useState<string | null>(null);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorDialogInitialName, setAuthorDialogInitialName] = useState("");
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

  const status = watch("status");
  const seriesId = watch("series_id");

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
  }

  function handleImportMethodChange(value: string) {
    if (value !== "isbn" && value !== "title") return;
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
      const created = await addSeries(trimmedSeriesName);
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

  function handleCreateAuthor(initialName: string) {
    setAuthorDialogInitialName(initialName);
    setAuthorDialogOpen(true);
  }

  function handleSavedAuthor(authorName: string) {
    const currentAuthors = watch("authors");
    const nextAuthors = Array.from(
      new Map(
        [...currentAuthors, authorName]
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => [name.toLowerCase(), name] as const),
      ).values(),
    );
    setValue("authors", nextAuthors, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  async function onSubmit(values: FormValues) {
    try {
      const authors = values.authors.map((author) => author.trim()).filter(Boolean);
      if (authors.length === 0) {
        setError("authors", { message: "At least one author is required" });
        return;
      }
      const parsedPublicationDate = parsePublicationDateInput(values.publication_date);
      if (values.publication_date.trim() && !parsedPublicationDate) {
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
      if (values.price.trim() && (!Number.isFinite(parsedPrice) || parsedPrice! < 0)) {
        setError("price", { message: "Enter a price of zero or more." });
        return;
      }
      if (values.purchase_url.trim()) {
        try {
          const url = new URL(values.purchase_url.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        } catch {
          setError("purchase_url", { message: "Enter a valid web link, including https://." });
          return;
        }
      }
      if (addToWishlist) {
        if (!user) throw new Error("Not authenticated");
        try {
          await createWishlistItem(user.id, {
            title: values.title, authors, genre_ids: values.genres,
            genres: values.genres.map((id) => genres.find((genre) => genre.id === id)?.name ?? "").filter(Boolean),
            language: (values.language as BookLanguage) || null, format: (values.format as BookFormat) || null,
            total_pages: values.total_pages ? Number(values.total_pages) : null,
            publication_date: parsedPublicationDate?.date ?? null, description: values.description.trim() || null,
            isbn: scannedIsbn || null, metadata_source: metadataSource || null, metadata_source_url: metadataSourceUrl || null,
            series_id: values.series_id || null, volume_number: parsedVolumeNumber,
            price: parsedPrice, purchase_url: values.purchase_url.trim() || null,
            cover_url: null, cover_entity_id: null,
          }, coverFile ?? undefined);
        } catch (error) {
          if (error && typeof error === "object" && "item" in error) onWishlistSaved?.();
          throw error;
        }
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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 rounded-xl border bg-card p-5">
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-1">
              <label className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                Add to Wishlist
                <input type="checkbox" checked={addToWishlist} onChange={(event) => setAddToWishlist(event.target.checked)} className="h-4 w-4" />
              </label>
              <div className="flex items-center gap-3">
                <p className="shrink-0 text-sm font-medium text-foreground">Search by</p>
                <Tabs
                  value={importMethod}
                  onValueChange={handleImportMethodChange}
                  className="min-w-0 flex-1"
                >
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="isbn"
                      disabled={isbnStatus === "looking-up" || titleSearchStatus === "searching" || isApplyingTitleResult}
                    >
                      ISBN
                    </TabsTrigger>
                    <TabsTrigger
                      value="title"
                      disabled={isbnStatus === "looking-up" || titleSearchStatus === "searching" || isApplyingTitleResult}
                    >
                      Book title
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

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
                        className="w-full gap-2"
                        onClick={() => { setShowScanner(true); setIsbnError(null); }}
                        disabled={isbnStatus === "looking-up"}
                      >
                        <ScanBarcode className="h-4 w-4" />
                        Scan ISBN barcode
                      </Button>
                      <div className="flex gap-2">
                        <Input
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
                          size="sm"
                          className="h-9"
                          disabled={!manualIsbn.trim() || isbnStatus === "looking-up"}
                          onClick={() => handleIsbnLookup(manualIsbn)}
                        >
                          Look up
                        </Button>
                      </div>
                    </div>
                  )}

                  {isbnStatus === "looking-up" && (
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking up book…
                    </p>
                  )}

                  {isbnError && (
                    <p className="text-sm text-destructive text-center">{isbnError}</p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="title-search"
                      placeholder="Enter book title"
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
                      size="sm"
                      className="h-9"
                      disabled={!titleQuery.trim() || titleSearchStatus === "searching" || isApplyingTitleResult}
                      onClick={() => void handleTitleSearch()}
                    >
                      {titleSearchStatus === "searching" ? "Looking up…" : "Look up"}
                    </Button>
                  </div>

                  {titleSearchStatus === "searching" && (
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching book catalogs…
                    </p>
                  )}

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
                    <div className="grid gap-2 sm:grid-cols-2">
                      {titleSearchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="flex min-w-0 items-center gap-3 rounded-lg border bg-surface p-2 text-left transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60"
                          onClick={() => void handleTitleResultSelect(result)}
                          disabled={isApplyingTitleResult}
                        >
                          <div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                            {result.coverUrl ? (
                              <img
                                src={result.coverUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImagePlus className="h-4 w-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <span className="min-w-0 space-y-0.5">
                            <span className="block truncate text-sm font-medium">{result.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.authors.join(", ")}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[result.publicationDate?.slice(0, 4), result.isbn].filter(Boolean).join(" · ") ||
                                "Edition details unavailable"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cover, title, authors, and genres match the Edit book layout. */}
              <div className="grid gap-5 md:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)]">
                <div className="md:row-span-3 md:self-start">
                <label
                  htmlFor="cover-upload"
                  className="group relative flex aspect-[2/3] w-[min(7rem,38vw)] cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm sm:w-28 md:w-full"
                >
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <ImagePlus className="h-5 w-5 text-white" />
                  </div>
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {coverFile && <p className="mt-2 truncate text-xs text-muted-foreground">{coverFile.name}</p>}
                </div>

                <div className="min-w-0 space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      {...register("title", { required: "Title is required" })}
                      aria-invalid={!!errors.title}
                    />
                    {errors.title && (
                      <p className="text-xs text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  {/* Authors */}
                  <div className="space-y-1.5">
                    <Label>Authors *</Label>
                    <Controller
                      name="authors"
                      control={control}
                      rules={{
                        validate: (value) => (value?.length ?? 0) > 0 || "At least one author is required",
                      }}
                      render={({ field }) => (
                        <AuthorMultiSelect
                          value={field.value ?? []}
                          onChange={field.onChange}
                          onCreateNew={handleCreateAuthor}
                        />
                      )}
                    />
                  {errors.authors && (
                      <p className="text-xs text-destructive">{errors.authors.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Genres</Label>
                    <Controller
                      name="genres"
                      control={control}
                      render={({ field }) => (
                        <GenreMultiSelect value={field.value ?? []} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!addToWishlist && <div className="order-0 space-y-1.5">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>}

              {/* Language */}
              <div className="order-1 space-y-1.5">
                <Label>Language</Label>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
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

              {/* Secondary metadata */}
              <div className="contents">
                <div className="order-3 space-y-1.5">
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

                <div className="order-4 space-y-1.5">
                  <Label>Format</Label>
                  <Controller
                    name="format"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger>
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

                <div className="order-5 space-y-1.5">
                  <Label>Source</Label>
                  <Controller
                    name="source"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger>
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

                <div className="order-6 space-y-1.5">
                  <Label>ISBN</Label>
                  <Input value={scannedIsbn ?? manualIsbn} readOnly placeholder="Scanned or looked up ISBN" />
                </div>
              </div>

              <div className="order-12 space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={5} {...register("description")} />
              </div>

              {/* Pages */}
              <div className="order-2 space-y-1.5">
                <Label htmlFor="total_pages">Total pages</Label>
                <Input
                  id="total_pages"
                  type="number"
                  min={1}
                  {...register("total_pages")}
                />
              </div>

              {/* Current progress (Reading only) */}
              {!addToWishlist && status === "Reading" && (
                <div className="order-7 space-y-1.5">
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
                <div className="order-8 space-y-1.5">
                  <Label htmlFor="date_started">Date started</Label>
                  <Input id="date_started" type="date" {...register("date_started")} />
                </div>
              )}
              {!addToWishlist && showDateFinished && (
                <div className="order-9 space-y-1.5">
                  <Label htmlFor="date_finished">Date finished</Label>
                  <Input id="date_finished" type="date" {...register("date_finished")} />
                </div>
              )}

              {/* Series */}
              <div className="order-10 space-y-1.5">
                <Label>Series</Label>
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
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {series.map((s) => (
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
                  <div className="flex gap-2 mt-1">
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
                <div className="order-11 space-y-1.5 sm:max-w-[10rem]">
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

              {addToWishlist && <>
                <div className="order-12 space-y-1.5 sm:max-w-[12rem]">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="number" min="0" step="0.01" inputMode="decimal" {...register("price")} />
                  {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                </div>
                <div className="order-12 space-y-1.5 sm:col-span-2">
                  <Label htmlFor="purchase_url">Purchase link</Label>
                  <Input id="purchase_url" type="url" placeholder="https://…" {...register("purchase_url")} />
                  {errors.purchase_url && <p className="text-xs text-destructive">{errors.purchase_url.message}</p>}
                </div>
              </>}

              {/* Root error */}
              {errors.root && (
                <p className="order-[13] text-sm text-destructive">{errors.root.message}</p>
              )}
              </div>
            </div>
          </ScrollArea>

          <SaveCancelBar
            mode="inline"
            onCancel={() => onOpenChange(false)}
            saving={isSubmitting}
            saveLabel={addToWishlist ? "Add to Wishlist" : "Add Book"}
          />
        </form>
      </DialogContent>
      <AddAuthorDialog
        open={authorDialogOpen}
        onOpenChange={setAuthorDialogOpen}
        initialName={authorDialogInitialName}
        onSaved={(author) => handleSavedAuthor(author.name)}
      />
    </Dialog>
  );
}
