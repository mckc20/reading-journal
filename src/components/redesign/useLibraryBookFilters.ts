import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Series } from '@/types';
import {
  applyLibraryFilters, buildActiveFilterChips, buildLibraryFilterOptions, filterKeys,
  getLibraryFilters, type LibraryFilterBook, type LibraryFilterKey,
} from '@/lib/libraryBookFilters';
import type { LibraryPreviewBook } from './LibraryPreview';

const noSeries: Series[] = [];

function filterRecord(book: LibraryPreviewBook): LibraryFilterBook {
  return book.filterRecord ?? {
    authors: book.author ? [book.author] : [],
    status: book.status,
    created_at: book.addedAt,
    format: book.format,
    language: book.language,
    source: book.source,
  };
}

export function useLibraryBookFilters(books: LibraryPreviewBook[], series = noSeries) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPanel = searchParams.get('filters');
  const focusedFilter: 'author' | 'genre' | undefined = filterPanel === 'author' || filterPanel === 'genre' ? filterPanel : undefined;
  const filters = useMemo(() => getLibraryFilters(searchParams), [searchParams]);
  const chips = buildActiveFilterChips(filters);
  const library = useMemo(() => books.map(book => ({ ...filterRecord(book), book })), [books]);
  const options = useMemo(() => buildLibraryFilterOptions(library, series), [library, series]);
  const filteredBooks = useMemo(() => applyLibraryFilters(library, filters, series).map(item => item.book), [library, filters, series]);

  function clearFilters(keys: LibraryFilterKey[] = filterKeys) {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      keys.forEach(key => next.delete(key));
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function toggleFilter(key: LibraryFilterKey, value: string) {
    if (!value) return clearFilters([key]);
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      const values = getLibraryFilters(current)[key];
      next.delete(key);
      const selected = values.includes(value) ? values.filter(option => option !== value) : [...values, value];
      selected.forEach(option => next.append(key, option));
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function closeLinkedFilters() {
    if (!focusedFilter) return;
    const next = new URLSearchParams(searchParams);
    next.delete('filters');
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  return { filters, chips, options, filteredBooks, focusedFilter, toggleFilter, clearFilters, closeLinkedFilters };
}
