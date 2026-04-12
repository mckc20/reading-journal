import { createContext, useContext, type ReactNode } from "react";
import { useBooks, type AddBookPayload } from "@/hooks/useBooks";
import type { Book } from "@/types";

interface BooksContextValue {
  books: Book[];
  loading: boolean;
  error: string | null;
  addBook: (payload: AddBookPayload, coverFile?: File) => Promise<void>;
  updateBook: (id: string, payload: Partial<Book>) => Promise<void>;
  updateCover: (id: string, file: File) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const BooksContext = createContext<BooksContextValue | null>(null);

export function BooksProvider({ children }: { children: ReactNode }) {
  const value = useBooks();
  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooksContext(): BooksContextValue {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error("useBooksContext must be used within BooksProvider");
  return ctx;
}
