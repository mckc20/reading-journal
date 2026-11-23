import { Navigate, useOutletContext, useSearchParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { LibraryBooks } from "@/components/redesign/LibraryPreview";
import { useLibraryBooks } from "./library/useLibraryBooks";

const libraryRedirectParamKeys = [
  "q",
  "sort",
  "display",
  "mode",
  "value",
  "genre",
  "rating",
  "year",
  "format",
  "language",
  "source",
  "status",
  "progress",
  "publicationYear",
  "series",
  "author",
  "favorite",
];

export default function Library() {
  const books = useLibraryBooks();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");

  if ((view && view !== "all") || libraryRedirectParamKeys.some(key => searchParams.has(key))) {
    return <Navigate to={`/library/books?${searchParams.toString()}`} replace />;
  }

  if (searchParams.get("tab") === "collections") {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    return <Navigate to={`/library/collections${next.size ? `?${next}` : ""}`} replace />;
  }

  return <LibraryBooks {...books} onAddBook={trigger => openAddBook(undefined, trigger)} />;
}
