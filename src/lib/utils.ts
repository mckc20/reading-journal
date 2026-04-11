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
  if (status === "DNF") return "destructive";
  if (status === "Up Next") return "secondary";
  return "outline";
}
