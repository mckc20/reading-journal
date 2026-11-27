import { useMemo, type Ref } from "react";
import { Search } from "lucide-react";
import { BookCover } from "@/components/reading-journal/BookCover";
import { BookStatus } from "@/components/reading-journal/BookStatus";
import { Input } from "@/components/ui/input";
import type { BookStatus as BookStatusValue } from "@/types";

interface BookSearchEntry {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
  status?: BookStatusValue;
}

export function BookSearchPicker({ books, selected, query, onQueryChange, onToggle, disabled, searchRef }: {
  books: readonly BookSearchEntry[];
  selected: ReadonlySet<string>;
  query: string;
  onQueryChange: (query: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  disabled?: boolean;
  searchRef?: Ref<HTMLInputElement>;
}) {
  const needle = query.trim().toLocaleLowerCase();
  const sortedBooks = useMemo(() => [...books].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
  ), [books]);
  const results = needle
    ? sortedBooks.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle))
    : sortedBooks;

  return <div className="min-w-0 space-y-2">
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input ref={searchRef} type="search" aria-label="Search books" placeholder="Search by title or author" value={query}
        disabled={disabled} onChange={event => onQueryChange(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} className="min-w-0 pl-9" />
    </div>
    {results.length > 0 ? <ul aria-label={needle ? "Book search results" : "Available books"}
      className="max-h-[min(12rem,45dvh)] min-w-0 overflow-y-auto rounded-lg border bg-popover p-1 shadow-sm">
      {results.map(book => <li key={book.id}>
        <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
          <input type="checkbox" className="size-[18px] shrink-0 accent-primary" disabled={disabled}
            checked={selected.has(book.id)} onChange={event => onToggle(book.id, event.target.checked)} />
          <BookCover src={book.cover} title={book.title} className="w-8 shrink-0" decorative />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="block text-sm font-medium">{book.title}</span>
            <span className="block text-xs text-muted-foreground">{book.author || "Unknown author"}</span>
            {book.status && <BookStatus status={book.status} />}
          </span>
        </label>
      </li>)}
    </ul> : <p className="text-sm text-muted-foreground">
      {books.length ? "No matching books." : "There are no eligible books to add."}
    </p>}
  </div>;
}
