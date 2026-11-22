import type { ProfilePreviewData, ProfilePreviewProps } from '@/components/redesign/ProfilePreview';

// Fictional cover artwork and catalog; no lookup service or account-derived suggestions.
const cover = (title: string, color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="270" viewBox="0 0 180 270"><rect width="180" height="270" fill="${color}"/><circle cx="130" cy="88" r="54" fill="#fff" opacity=".2"/><path d="M0 190Q60 120 180 210V270H0Z" fill="#21150f" opacity=".16"/><path d="M24 24V246" stroke="#fff" opacity=".4"/><text x="40" y="155" fill="#21150f" font-family="Georgia" font-size="18">${title}</text></svg>`)}`;
export const profileCatalog: ProfilePreviewProps['catalog'] = {
  genre: [{ id: 'fantasy', name: 'Quiet fantasy', detail: 'A little wonder in the everyday.' }, { id: 'mystery', name: 'Mystery' }, { id: 'nature', name: 'Nature writing' }],
  author: [{ id: 'mira', name: 'Mira Wren', detail: 'Stories of belonging and small adventures.' }, { id: 'river', name: 'River Ellis' }, { id: 'sol', name: 'Sol Arden' }],
  series: [{ id: 'tide', name: 'The Tideglass Letters', detail: 'A trilogy by Mira Wren', cover: cover('Tideglass', '#a8bdc1') }, { id: 'orchard', name: 'The Orchard Almanacs', detail: 'By Sol Arden' }],
  book: [{ id: 'atlas', name: 'An Atlas of Quiet Places', detail: 'River Ellis', cover: cover('Quiet Places', '#eac982') }, { id: 'lantern', name: 'The Last Lantern', detail: 'Mira Wren', cover: cover('Last Lantern', '#d6aab3') }, { id: 'garden', name: 'A Garden After Rain', detail: 'Sol Arden' }],
};
export const readerProfile: ProfilePreviewData = {
  name: 'Eden Reed', bio: 'Usually reading by a window. Here for gentle adventures, complicated friendships, and sentences worth keeping.',
  favorites: { genre: profileCatalog.genre[0], author: profileCatalog.author[0], series: profileCatalog.series[0], book: profileCatalog.book[0] },
};
export const newReaderProfile: ProfilePreviewData = { name: 'Eden Reed', bio: '', favorites: {} };
export const longReaderProfile: ProfilePreviewData = {
  name: 'Alexandria Juniper Vale of the Faraway Reading Room',
  bio: 'Collecting stories about unfamiliar places, friendships that change with the seasons, and all the little things we almost walk past.\nThere is always room for one more chapter.',
  favorites: { genre: { id: 'long-genre', name: 'Atmospheric speculative fiction and nature-inspired adventures' }, author: { id: 'long-author', name: 'Alexandria Willow Peregrine' }, book: { id: 'long-book', name: 'An Unreasonably Long Journey Through the Uncharted Gardens of the Northern Archipelago', detail: 'Alexandria Willow Peregrine' } },
};
