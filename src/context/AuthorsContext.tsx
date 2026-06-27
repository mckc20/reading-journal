import { createContext, useContext, type ReactNode } from "react";
import { useAuthors } from "@/hooks/useAuthors";
import type { Author } from "@/types";
import type { AuthorInput } from "@/lib/authors";

interface AuthorsContextValue {
  authors: Author[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addAuthor: (input: AuthorInput) => Promise<Author>;
  editAuthor: (id: string, input: AuthorInput) => Promise<Author>;
  removeAuthor: (id: string) => Promise<void>;
}

const AuthorsContext = createContext<AuthorsContextValue | null>(null);

export function AuthorsProvider({ children }: { children: ReactNode }) {
  const value = useAuthors();
  return <AuthorsContext.Provider value={value}>{children}</AuthorsContext.Provider>;
}

export function useAuthorsContext(): AuthorsContextValue {
  const ctx = useContext(AuthorsContext);
  if (!ctx) throw new Error("useAuthorsContext must be used within AuthorsProvider");
  return ctx;
}
