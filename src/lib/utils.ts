import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BookStatus } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function statusVariant(
  status: BookStatus
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Reading") return "default";
  if (status === "Paused") return "secondary";
  if (status === "DNF") return "destructive";
  if (status === "Up Next") return "secondary";
  return "outline";
}

export function getTodayLocalDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function parseGenresInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((genre) => genre.trim())
        .filter(Boolean)
    )
  )
}

export function formatGenresInput(genres?: string[]): string {
  return genres?.join(", ") ?? ""
}

export function parseAuthorsInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((author) => author.trim())
        .filter(Boolean)
    )
  )
}

export function formatAuthorsInput(authors?: string[]): string {
  return authors?.join(", ") ?? ""
}
