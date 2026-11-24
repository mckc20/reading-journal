import { useState } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { LibraryPreview, type LibraryPreviewProps } from '@/components/redesign/LibraryPreview';
import { HomeShell } from '@/components/redesign/HomeShell';
import { LibraryTabs } from '@/components/redesign/LibraryNavigation';
import { libraryBooks } from './libraryFixtures';
import { CollectionsPreview } from '@/components/redesign/CollectionsPreview';
import { CollectionSearch } from '@/components/redesign/CollectionSearch';
import { LibrarySeriesEntries } from '@/components/redesign/LibrarySeriesEntries';

function SeriesReview({ onOpen }: { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const entries = [
    { id: 'monk-robot', title: 'Monk & Robot', author: 'Becky Chambers', books: libraryBooks.slice(0, 1) },
    { id: 'quiet-places', title: 'Quiet Places', author: 'Alex Rowan', books: libraryBooks.slice(2, 5) },
  ].filter(entry => `${entry.title} ${entry.author}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <CollectionSearch collection="Series" query={query} onQueryChange={setQuery}>
    {({ desktopSearch }) => <div className="rj-library-preview">
      <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
      <LibrarySeriesEntries entries={entries} onOpen={onOpen} />
    </div>}
  </CollectionSearch>;
}


function LibraryReview(args: LibraryPreviewProps) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(args.error);
  const preview = (message: string) => setNotice(`${message} — preview only`);
  const props = {
    ...args,
    error,
    onRetry: () => setError(undefined),
    onOpenBook: (book: LibraryPreviewProps['books'][number]) => preview(`Book details: ${book.title}`),
    onNavigate: preview,
    onCreate: (destination: string) => preview(`Create ${destination}`),
    onNotifications: () => preview('Notifications'),
  };
  return <MemoryRouter initialEntries={['/library']}>
    <Routes>
      <Route path="/library" element={<HomeShell {...props} activeDestination="Library"><LibraryTabs><Outlet /></LibraryTabs></HomeShell>}>
        <Route index element={<LibraryPreview {...props} />} />
        <Route path="collections" element={<CollectionsPreview {...props} />} />
        <Route path="series" element={<SeriesReview onOpen={id => preview(`Series details: ${id}`)} />} />
      </Route>
    </Routes>
    {notice && <div role="status" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(90%, 520px)', padding: 12, borderRadius: 12, background: '#21150f', color: 'white', fontSize: 13 }}>{notice}</div>}
  </MemoryRouter>;
}
const noop = () => {};
const meta = {
  title: 'Redesign/Library', component: LibraryPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'The Books, Collections and Series views used by the signed-in Library overview. Storybook uses fictional data and reports intent for creating a book and opening book or series details. Wishlist entries appear under Collections. Advanced filters and bulk tools are available in the app’s separate All books page.' } } },
  args: { books: libraryBooks, onRetry: noop, onOpenBook: noop, onNavigate: noop, onCreate: noop, onNotifications: noop },
  render: args => <LibraryReview key={JSON.stringify([args.books, args.error, args.loading, args.initialQuery])} {...args} />,
} satisfies Meta<typeof LibraryPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Sparse: Story = { args: { books: libraryBooks.slice(0, 1) } };
export const Empty: Story = { args: { books: [libraryBooks[7]] } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please check your connection and try again.' } };
export const NoResults: Story = { args: { initialQuery: 'A book that is not here' } };
export const BrowseCollections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = within(canvas.getByRole('tablist', { name: 'Library collections' }));
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'title');
    await userEvent.click(canvas.getByRole('button', { name: 'List view' }));
    await expect(navigation.getAllByRole('tab')).toHaveLength(3);
    await expect(navigation.getByRole('tab', { name: 'Series' })).toBeVisible();
    await userEvent.click(navigation.getByRole('tab', { name: 'Collections' }));
    await expect(canvas.queryByRole('combobox', { name: 'Sort by' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'List view' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'Default collections' })).toHaveAttribute('data-view', 'grid');
    await userEvent.click(within(canvas.getByRole('list', { name: 'Default collections' })).getByRole('button', { name: 'Wishlist' }));
    await expect(within(canvas.getByRole('list', { name: 'Library books' })).getByRole('button', { name: 'A Future Adventure' })).toBeVisible();
    await userEvent.click(within(canvas.getByRole('tablist', { name: 'Library collections' })).getByRole('tab', { name: 'Books' }));
    await expect(canvas.getByRole('list', { name: 'Library books' }).children).toHaveLength(7);
    await expect(canvas.getByRole('combobox', { name: 'Sort by' })).toHaveValue('title');
    await expect(canvas.getByRole('list', { name: 'Library books' })).toHaveAttribute('data-view', 'list');
    await expect(canvas.queryByRole('button', { name: 'A Future Adventure' })).not.toBeInTheDocument();
    await userEvent.click(navigation.getByRole('tab', { name: 'Series' }));
    await expect(canvas.queryByRole('button', { name: 'Grid view' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'Series collection' }).querySelectorAll('.rj-collection-art')).toHaveLength(2);
  },
};
export const SearchAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = () => within(canvas.getByRole('list', { name: 'Library books' }));
    await expect(list().getAllByRole('listitem')).toHaveLength(7);
    await expect(canvas.queryByRole('button', { name: 'A Future Adventure' })).not.toBeInTheDocument();
    if (!window.matchMedia('(max-width: 767px)').matches) {
      const search = canvas.getByRole('searchbox', { name: 'Search your books' });
      await userEvent.type(search, 'chambers');
      await expect(list().getAllByRole('listitem')).toHaveLength(1);
      await expect(list().getByRole('button', { name: 'A Psalm for the Wild-Built' })).toBeVisible();
      await userEvent.clear(search);
    }
    await expect(canvas.queryByRole('combobox', { name: 'Reading status' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('combobox', { name: 'Source' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('checkbox', { name: 'Favorites only' })).not.toBeInTheDocument();

  },
};

export const MobileSearch: Story = {
  parameters: { docs: { description: { story: 'Below 768px, pull down at the top of Library to reveal search under the tabs. Focusing the field keeps the books visible. Typing filters the active tab in place.' } } },
  play: async ({ canvasElement }) => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const canvas = within(canvasElement);
    const heading = canvas.getByRole('heading', { name: 'Library' });
    const list = () => within(canvas.getByRole('list', { name: 'Library books' }));
    const searchBar = canvasElement.querySelector('.rj-library-mobile-search');
    const touch = (type: string, clientY: number) => {
      // Plain Events also run in browsers without a constructible Touch class.
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', { value: [{ clientX: 100, clientY }] });
      fireEvent(heading, event);
    };
    await expect(searchBar).not.toHaveAttribute('data-revealed');
    touch('touchstart', 130);
    touch('touchmove', 90);
    touch('touchend', 60);
    await expect(searchBar).not.toHaveAttribute('data-revealed');
    touch('touchstart', 60);
    touch('touchmove', 88);
    await waitFor(() => expect(searchBar).toHaveAttribute('data-pulling'));
    await expect(searchBar).toHaveAttribute('data-revealed');
    await expect(searchBar!.getBoundingClientRect().height).toBeCloseTo(32);
    touch('touchmove', 130);
    touch('touchend', 130);
    await waitFor(() => expect(searchBar).not.toHaveAttribute('data-pulling'));
    const search = canvas.getByRole('searchbox', { name: 'Search your books' });
    await userEvent.click(search);
    await expect(search).toHaveFocus();
    await expect(heading).toBeVisible();
    await expect(list().getAllByRole('listitem')).toHaveLength(7);
    await userEvent.type(search, 'c');
    await expect(list().getAllByRole('listitem').length).toBeLessThan(7);
    await userEvent.type(search, 'hambers');
    await expect(list().getAllByRole('listitem')).toHaveLength(1);
    await expect(list().getByRole('button', { name: 'A Psalm for the Wild-Built' })).toBeVisible();
    await userEvent.clear(search);
    await userEvent.type(search, 'no matching book');
    await expect(canvas.getByText('No books found')).toBeVisible();
    touch('touchstart', 168);
    touch('touchmove', 143);
    touch('touchend', 120);
    await expect(searchBar).not.toHaveAttribute('data-revealed');
    await expect(canvas.getByText('No books found')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Hide search' })).not.toBeInTheDocument();
    touch('touchstart', 60);
    touch('touchend', 130);
    await expect(search).toHaveValue('no matching book');
    search.focus();
    await userEvent.keyboard('{Escape}');
    await expect(list().getAllByRole('listitem')).toHaveLength(7);
    await expect(searchBar).not.toHaveAttribute('data-revealed');
    await expect(canvasElement.querySelector('.rj-collection-search')).toHaveFocus();
  },
};
export const SortingAndLayout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titles = () => within(canvas.getByRole('list', { name: 'Library books' })).getAllByRole('button').map(button => (button.querySelector('.rj-library-list-title') ?? button).textContent);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'title');
    await expect(titles()[1]).toBe('An Atlas of Quiet Places and the People Who Find Them');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'author');
    await expect(titles()[2]).toBe('The Hobbit');
    await userEvent.click(canvas.getByRole('button', { name: 'List view' }));
    await expect(canvas.getByRole('list', { name: 'Library books' })).toHaveAttribute('data-view', 'list');
    await expect(canvas.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'recent');
    await expect(titles()[0]).toBe('A Psalm for the Wild-Built');
  },
};
