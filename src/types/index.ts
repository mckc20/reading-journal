export type BookStatus =
  | "Wishlist"
  | "Not Started"
  | "Up Next"
  | "Reading"
  | "Finished"
  | "DNF";

export type BookLanguage = "German" | "Spanish" | "English";

export type BookBelongsTo = "Me" | "Family" | "Friends" | "Library";

export type BookFormat = "eBook" | "Audiobook" | "Paperback" | "Hardcover";

export type BookMetadataSource = "open_library" | "google_books";

export interface Series {
  id: string;
  name: string;
  journal_content?: string;
  user_id: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  genres?: string[];
  status: BookStatus;
  cover_url?: string;
  rating?: number; // 1–5
  is_favorite: boolean;
  current_page?: number;
  total_pages?: number;
  date_started?: string;
  date_finished?: string;
  language?: BookLanguage;
  belongs_to?: BookBelongsTo;
  format?: BookFormat;
  isbn?: string;
  metadata_source?: BookMetadataSource | null;
  metadata_source_url?: string | null;
  series_id?: string;
  volume_number?: number;
  user_id: string;
  created_at: string;
}

export interface ReadingLog {
  id: string;
  book_id: string;
  user_id: string;
  current_page: number;
  reading_time_minutes?: number;
  logged_at: string;
}
