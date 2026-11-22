import type { LibraryPreviewBook } from '@/components/redesign/LibraryPreview';
import { books } from './fixtures';

export const libraryBooks: LibraryPreviewBook[] = [
  { ...books[0], status: 'Reading', source: 'Owned', favorite: true, addedAt: '2026-11-10' },
  { ...books[1], status: 'Paused', source: 'Library', addedAt: '2026-11-09' },
  { ...books[2], status: 'Finished', currentPage: 387, source: 'Friends', favorite: true, addedAt: '2026-11-08' },
  { ...books[3], status: 'Up Next', source: 'Family', addedAt: '2026-11-07' },
  { ...books[4], status: 'To Read', source: 'Owned', addedAt: '2026-11-06' },
  { id: 'lanterns', title: 'The Last Lantern on the Hill', author: 'Morgan Vale', currentPage: 32, totalPages: null, status: 'DNF', source: 'Owned', addedAt: '2026-11-05' },
  { id: 'atlas', title: 'An Atlas of Quiet Places and the People Who Find Them', author: 'River Ellis', currentPage: 0, totalPages: 264, status: 'To Read', source: 'Owned', addedAt: '2026-11-04' },
  { id: 'wish', title: 'A Future Adventure', author: 'Alex Rowan', currentPage: 0, status: 'Wishlist', addedAt: '2026-11-15' },
];
