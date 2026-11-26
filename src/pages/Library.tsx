import { Navigate, useOutletContext, useSearchParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { LibraryBooks } from "@/components/redesign/LibraryPreview";
import { useSeries } from "@/hooks/useSeries";
import { legacyLibraryDestination } from "@/lib/libraryRedirects";
import { useLibraryBooks } from "./library/useLibraryBooks";

export default function Library() {
  const books = useLibraryBooks();
  const { series } = useSeries();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const [searchParams] = useSearchParams();
  if (searchParams.has("view")) {
    return <Navigate to={legacyLibraryDestination(searchParams.toString())} replace />;
  }

  if (searchParams.get("tab") === "collections") {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    return <Navigate to={`/library/collections${next.size ? `?${next}` : ""}`} replace />;
  }

  const query = searchParams.get("q") ?? "";
  return <LibraryBooks key={query} {...books} initialQuery={query} series={series}
    onAddBook={trigger => openAddBook(undefined, trigger)} />;
}
