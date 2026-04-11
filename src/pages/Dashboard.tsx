import { useState } from "react";
import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import BookDetailModal from "@/components/BookDetailModal";
import type { Book } from "@/types";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-muted aspect-[2/3]"
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { books, loading, error, updateBook, deleteBook, reload } = useBooksContext();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openBook(book: Book) {
    setSelectedBook(book);
    setModalOpen(true);
  }

  const currentlyReading = books.filter((b) => b.status === "Reading");
  const upNext = books.filter((b) => b.status === "Up Next");

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SkeletonGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const isEmpty = currentlyReading.length === 0 && upNext.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No active books yet.</p>
          <p className="text-sm text-muted-foreground">
            Tap <span className="font-medium">+</span> to add your first book.
          </p>
        </div>
      ) : (
        <>
          {currentlyReading.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">Currently Reading</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {currentlyReading.map((book) => (
                  <BookCard key={book.id} book={book} onClick={openBook} />
                ))}
              </div>
            </section>
          )}

          {upNext.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">Up Next</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {upNext.map((book) => (
                  <BookCard key={book.id} book={book} onClick={openBook} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <BookDetailModal
        book={selectedBook}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdated={updateBook}
        onDeleted={deleteBook}
      />
    </div>
  );
}
