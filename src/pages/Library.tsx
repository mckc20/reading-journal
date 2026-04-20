import { useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import BookCard from "@/components/BookCard";
import type { Book } from "@/types";

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (b: Book) => void }) {
  if (books.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} />
      ))}
    </div>
  );
}

export default function Library() {
  const { books, loading, error, reload } = useBooksContext();
  const { series } = useSeries();
  const navigate = useNavigate();

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  const allBooks = [...books].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
  );

  const tbrBooks = books.filter((b) =>
    ["Wishlist", "Not Started", "Up Next"].includes(b.status)
  );

  // Group books by series
  const seriesWithBooks = series
    .map((s) => ({
      ...s,
      books: books
        .filter((b) => b.series_id === s.id)
        .sort((a, b) => (a.volume_number ?? 0) - (b.volume_number ?? 0)),
    }))
    .filter((s) => s.books.length > 0);

  const standaloneBooks = books.filter((b) => !b.series_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? "…" : `${books.length} book${books.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All Books
          </TabsTrigger>
          <TabsTrigger value="tbr" className="flex-1">
            TBR {!loading && tbrBooks.length > 0 && `(${tbrBooks.length})`}
          </TabsTrigger>
          <TabsTrigger value="series" className="flex-1">
            Series
          </TabsTrigger>
        </TabsList>

        {/* All Books */}
        <TabsContent value="all">
          <div className="mt-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl bg-muted aspect-[2/3]" />
                ))}
              </div>
            ) : books.length === 0 ? (
              <EmptyTab message="No books yet. Tap + to add one." />
            ) : (
              <BooksGrid books={allBooks} onBook={openBook} />
            )}
          </div>
        </TabsContent>

        {/* TBR */}
        <TabsContent value="tbr">
          <div className="mt-3">
            {loading ? null : tbrBooks.length === 0 ? (
              <EmptyTab message="No books in your reading list." />
            ) : (
              <BooksGrid books={tbrBooks} onBook={openBook} />
            )}
          </div>
        </TabsContent>

        {/* Series */}
        <TabsContent value="series">
          <div className="mt-3">
            {loading ? null : seriesWithBooks.length === 0 && standaloneBooks.length === 0 ? (
              <EmptyTab message="No books yet." />
            ) : (
              <div className="space-y-6">
                {seriesWithBooks.map((s) => (
                  <section key={s.id} className="space-y-3">
                    <div>
                      <h3 className="font-medium">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {s.books.length} book{s.books.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Separator />
                    <BooksGrid books={s.books} onBook={openBook} />
                  </section>
                ))}

                {standaloneBooks.length > 0 && (
                  <section className="space-y-3">
                    <div>
                      <h3 className="font-medium text-muted-foreground">Standalone</h3>
                    </div>
                    <Separator />
                    <BooksGrid books={standaloneBooks} onBook={openBook} />
                  </section>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
