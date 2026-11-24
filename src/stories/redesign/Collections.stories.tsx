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
  const [error, setError] = useState(args.error);
  const preview = (action: string) => setNotice(`${action} — preview only.`);
  const props = {
    ...args,
    error,
    onRetry: () => setError(undefined),
    onNavigate: preview,
    onCreate: preview,
    onNotifications: () => preview('Notifications'),
    onOpenBook: (book: CollectionsPreviewProps['books'][number]) => preview(`Book details: ${book.title}`),
  };
  return <MemoryRouter initialEntries={['/library/collections']}>
    <Routes>
      <Route path="/library" element={<HomeShell {...props} activeDestination="Library"><LibraryTabs><Outlet /></LibraryTabs></HomeShell>}>
        <Route index element={<LibraryPreview {...props} />} />
        <Route path="collections" element={<CollectionsPreview {...props} />} />
        <Route path="series" element={<p role="status">Series — preview only</p>} />
      </Route>
    </Routes>
    {notice && <p role="status" className="rj-redesign" style={{ padding: 16 }}>{notice}</p>}
  </MemoryRouter>;
}

const noop = () => {};
const meta = {
  title: 'Redesign/Collections', component: CollectionsPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'A separate collection index with eight default collections: the seven canonical book statuses (including Wishlist) and Favorites. Cards use covers and live sample counts; empty cards stay available. Opening a card shows only its books using the shared Library book grid. Favorites contains favorite library books; wishes have their own Wishlist collection. Search is scoped to collection names on the index and to the selected collection’s books after opening. Fictional data only; nothing is persisted.' } } },
  args: { books: libraryBooks, onRetry: noop, onOpenBook: noop, onNavigate: noop, onCreate: noop, onNotifications: noop },
  render: args => <CollectionsReview key={JSON.stringify([args.books, args.initialCollection, args.loading, args.error])} {...args} />,
} satisfies Meta<typeof CollectionsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultCollections: Story = {};
export const Empty: Story = { args: { books: [] } };
export const Wishlist: Story = { args: { initialCollection: 'Wishlist' } };
export const Favorites: Story = { args: { initialCollection: 'Favorites' } };
export const EmptyCollection: Story = { args: { books: [], initialCollection: 'Reading' } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please check your connection and try again.' } };

export const OpenCollections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const index = () => within(canvas.getByRole('list', { name: 'Default collections' }));
    await expect(index().getAllByRole('listitem')).toHaveLength(8);
    await userEvent.click(index().getByRole('button', { name: 'Wishlist' }));
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
    await userEvent.click(index().getByRole('button', { name: 'Paused' }));
    list = within(canvas.getByRole('list', { name: 'Library books' }));
    await expect(list.getAllByRole('listitem')).toHaveLength(1);
    await expect(list.getByRole('button', { name: 'The Midnight Library' })).toBeVisible();
  },
};

export const SearchInsideWishlist: Story = {
  args: Wishlist.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      const searchButton = canvas.getByRole('button', { name: 'Search your wishlist books' });
      searchButton.focus();
      await userEvent.keyboard('{Enter}');
    }
    const body = within(canvasElement.ownerDocument.body);
    const scope = mobile ? within(await body.findByRole('dialog')) : canvas;
    const input = scope.getByRole('searchbox', { name: 'Search your wishlist books' });
    await userEvent.type(input, 'Chambers');
    await expect(scope.getByText(mobile ? 'No wishlist books found. Try another search.' : 'No books found')).toBeVisible();
    await userEvent.clear(input);
    await userEvent.type(input, 'Future');
    await expect(scope.getByRole('button', { name: mobile ? 'A Future Adventure Alex Rowan' : 'A Future Adventure' })).toBeVisible();
  },
};
