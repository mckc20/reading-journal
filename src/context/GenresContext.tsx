import { createContext, useContext, type ReactNode } from "react";
import { useGenres } from "@/hooks/useGenres";
import type { Genre, GenreTreeNode } from "@/types";

interface GenresContextValue {
  genres: Genre[];
  tree: GenreTreeNode[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const GenresContext = createContext<GenresContextValue | null>(null);

export function GenresProvider({ children }: { children: ReactNode }) {
  const value = useGenres();
  return <GenresContext.Provider value={value}>{children}</GenresContext.Provider>;
}

export function useGenresContext(): GenresContextValue {
  const ctx = useContext(GenresContext);
  if (!ctx) throw new Error("useGenresContext must be used within GenresProvider");
  return ctx;
}
