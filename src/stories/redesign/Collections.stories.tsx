import { useState } from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CollectionsPreview, type CollectionsPreviewProps } from '@/components/redesign/CollectionsPreview';
import { LibraryPreview } from '@/components/redesign/LibraryPreview';
import { HomeShell } from '@/components/redesign/HomeShell';
import { LibraryTabs } from '@/components/redesign/LibraryNavigation';
import { libraryBooks } from './libraryFixtures';

function CollectionsReview(args: CollectionsPreviewProps) {
  const [notice, setNotice] = useState('');
  const [books, setBooks] = useState(args.books);
  const [error, setError] = useState(args.error);
  const preview = (action: string) => setNotice(`${action} — preview only.`);
  const props = {
    ...args,
    books,
    error,
    onRetry: () => setError(undefined),
    onNavigate: preview,
    onCreate: preview,
    onNotifications: () => preview('Notifications'),
    onOpenBook: (book: CollectionsPreviewProps['books'][number]) => preview(`Book details: ${book.title}`),
  };
  const entry = args.initialCollection ? `/library/collections?collection=${encodeURIComponent(args.initialCollection)}` : '/library/collections';
  return <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/library" element={<HomeShell {...props} activeDestination="Library"><LibraryTabs><Outlet /></LibraryTabs></HomeShell>}>
        <Route index element={<LibraryPreview {...props} />} />
        <Route path="collections" element={<CollectionsPreview {...props} actions={{
          onCreateBook: collection => preview(`Create book in ${collection}`),
          onAddBook: async (collection, id) => setBooks(current => current.map(book => book.id !== id ? book
            : collection === 'Favorites' ? { ...book, favorite: true } : { ...book, status: collection })),
        }} />} />
        <Route path="series" element={<p role="status">Series — preview only</p>} />
      </Route>
    </Routes>
    {notice && <p role="status" className="rj-redesign" style={{ padding: 16 }}>{notice}</p>}
  </MemoryRouter>;
}

const noop = () => {};
const meta = {
  title: 'Redesign/Collections', component: CollectionsPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'The Collections tab contains To Read, Finished, DNF, Wishlist and Favorites. Cards use covers and titles. Status collections appear when they contain books. Opening a card shows only its books using the shared Library book list. Favorites contains favorite library books; wishes have their own Wishlist collection. Search is scoped to collection names on the index and to the selected collection’s books after opening. Individual collections have their own title, sort, filters, and Add book menu. The picker updates the sample data for this story.' } } },
  args: { books: libraryBooks, onRetry: noop, onOpenBook: noop, onNavigate: noop, onCreate: noop, onNotifications: noop, actions: { onCreateBook: noop, onAddBook: async () => {} } },
  render: args => <CollectionsReview key={JSON.stringify([args.books, args.initialCollection, args.loading, args.error])} {...args} />,
} satisfies Meta<typeof CollectionsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultCollections: Story = {};
export const Empty: Story = {
  args: { books: [] },
  play: async ({ canvasElement }) => {
    const index = within(within(canvasElement).getByRole('list', { name: 'Default collections' }));
    await expect(index.getAllByRole('button').map(button => button.textContent)).toEqual(['Favorites']);
  },
};
export const Wishlist: Story = { args: { initialCollection: 'Wishlist' } };
export const Favorites: Story = { args: { initialCollection: 'Favorites' } };
export const EmptyCollection: Story = { args: { books: [], initialCollection: 'Finished' } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please check your connection and try again.' } };

export const OpenCollections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const index = () => within(canvas.getByRole('list', { name: 'Default collections' }));
    await expect(index().getAllByRole('listitem')).toHaveLength(5);
    await userEvent.click(index().getByRole('button', { name: 'Wishlist' }));
    await expect(canvas.getByRole('heading', { name: 'Wishlist', level: 1 })).toHaveFocus();
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument();
    let list = within(canvas.getByRole('list', { name: 'Library books' }));
    await expect(list.getAllByRole('listitem')).toHaveLength(1);
    await expect(list.getByRole('button', { name: 'A Future Adventure' })).toBeVisible();
    await expect(list.queryByRole('button', { name: 'A Psalm for the Wild-Built' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'All collections' }));
    await waitFor(() => expect(index().getByRole('button', { name: 'Wishlist' })).toHaveFocus());
    await userEvent.click(index().getByRole('button', { name: 'Favorites' }));
    list = within(canvas.getByRole('list', { name: 'Library books' }));
    await expect(list.getAllByRole('listitem')).toHaveLength(2);
    await expect(list.getByRole('button', { name: 'A Psalm for the Wild-Built' })).toBeVisible();
    await expect(list.getByRole('button', { name: 'The Night Circus' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'All collections' }));
    await userEvent.click(index().getByRole('button', { name: 'Finished' }));
    list = within(canvas.getByRole('list', { name: 'Library books' }));
    await expect(list.getAllByRole('listitem')).toHaveLength(1);
    await expect(list.getByRole('button', { name: 'The Night Circus' })).toBeVisible();
  },
};

export const SearchInsideWishlist: Story = {
  args: Wishlist.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('searchbox', { name: 'Search your wishlist books' });
    input.focus();
    await userEvent.type(input, 'Chambers');
    await expect(canvas.getByText('No books found')).toBeVisible();
    await userEvent.clear(input);
    await userEvent.type(input, 'Future');
    await expect(canvas.getByRole('button', { name: 'A Future Adventure' })).toBeVisible();
  },
};

export const AddAndFilterBooks: Story = {
  args: {
    initialCollection: 'Wishlist',
    books: libraryBooks.map((book, index) => ({ ...book, format: index === 0 ? 'Paperback' : 'Hardcover' })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Add book' }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Choose from library' }));
    const picker = within(await body.findByRole('dialog', { name: 'Choose from library' }));
    await userEvent.click(picker.getByRole('checkbox', { name: /A Psalm for the Wild-Built/ }));
    await userEvent.click(picker.getByRole('checkbox', { name: /The Night Circus/ }));
    await userEvent.click(picker.getByRole('button', { name: 'Add 2 books' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('list', { name: 'Library books' }).children).toHaveLength(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Filter' }));
    const filter = within(await body.findByRole('dialog', { name: 'Filter books' }));
    await userEvent.selectOptions(filter.getByRole('combobox', { name: 'Format' }), 'Paperback');
    await userEvent.click(filter.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(canvas.getByRole('list', { name: 'Library books' }).children).toHaveLength(1));
    await expect(canvas.getByRole('button', { name: 'A Psalm for the Wild-Built' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Add book' }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Create new' }));
    await expect(await canvas.findByText('Create book in Wishlist — preview only.')).toBeVisible();
  },
};
