import type { Book } from '@/types';

export type BookFormDraft = Pick<Book, 'title' | 'authors' | 'status' | 'total_pages' | 'language' | 'source' | 'format' | 'isbn' | 'description' | 'genres' | 'cover_url' | 'series_id' | 'volume_number' | 'publication_date' | 'current_page' | 'date_started' | 'date_finished' | 'price' | 'purchase_url'>;
export type BookLookupResult = Partial<BookFormDraft> & Pick<BookFormDraft, 'title' | 'authors'> & { id: string };
export type BookLookupMode = 'isbn' | 'title';
