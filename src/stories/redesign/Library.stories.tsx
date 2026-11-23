import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { LibraryPreview, type LibraryPreviewProps } from '@/components/redesign/LibraryPreview';
import { libraryBooks } from './libraryFixtures';
import { CollectionsPreview } from '@/components/redesign/CollectionsPreview';


function LibraryReview(args: LibraryPreviewProps) {
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState<'Books' | 'Collections'>('Books');
  const [error, setError] = useState(args.error);
  const preview = (message: string) => setNotice(`${message} — preview only`);
  return <>
    {page === 'Collections' ? <CollectionsPreview {...args} error={error} onRetry={() => setError(undefined)} onNavigate={destination => preview(destination)} onCreate={destination => preview(`Create ${destination}`)} onNotifications={() => preview('Notifications')} onLibraryNavigate={destination => { if (destination === 'Books') setPage('Books'); else if (destination === 'Series') preview('Series'); }} onOpenBook={book => preview(`Book details: ${book.title}`)} /> : <LibraryPreview {...args} error={error} onRetry={() => { setError(undefined); preview('Library reloaded'); }}
      onOpenBook={book => preview(`Book details: ${book.title}`)}
      onNavigate={destination => preview(destination)} onCreate={destination => preview(`Create ${destination}`)}
      onNotifications={() => preview('Notifications')} onCollection={collection => { if (collection === 'Collections') setPage('Collections'); else preview(collection); }} />}
    {notice && <div role="status" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(90%, 520px)', padding: 12, borderRadius: 12, background: '#21150f', color: 'white', fontSize: 13 }}>{notice}</div>}
  </>;
}
const noop = () => {};
const meta = {
  title: 'Redesign/Library', component: LibraryPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'The Books and Collections views used by the signed-in Library overview. Storybook uses fictional data and reports intent for Series, creating a book and opening book details. Wishlist entries appear under Collections. Advanced filters and bulk tools are available in the app’s separate All books page.' } } },
  args: { books: libraryBooks, onRetry: noop, onOpenBook: noop, onNavigate: noop, onCreate: noop, onNotifications: noop, onCollection: noop },
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
    const navigation = within(canvas.getByRole('navigation', { name: 'Library collections' }));
    await expect(navigation.getAllByRole('button').map(button => button.textContent)).toEqual(['Books', 'Collections', 'Series']);
    await userEvent.click(navigation.getByRole('button', { name: 'Collections' }));
    await userEvent.click(within(canvas.getByRole('list', { name: 'Default collections' })).getByRole('button', { name: 'Wishlist' }));
    await expect(within(canvas.getByRole('list', { name: 'Library books' })).getByRole('button', { name: 'A Future Adventure' })).toBeVisible();
    await userEvent.click(within(canvas.getByRole('navigation', { name: 'Library collections' })).getByRole('button', { name: 'Books' }));
    await expect(canvas.getByRole('list', { name: 'Library books' }).children).toHaveLength(7);
    await expect(canvas.queryByRole('button', { name: 'A Future Adventure' })).not.toBeInTheDocument();
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
  parameters: { docs: { description: { story: 'Review below 768px. Swipe up on page content to reveal search; swipe down to hide. Focusing search replaces the page with book-only results after two characters. Search button provides a keyboard/tap alternative. Cancel/Escape returns to the same browse view and scroll position.' } } },
  play: async ({ canvasElement }) => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const canvas = within(canvasElement);
    const heading = canvas.getByRole('heading', { name: 'Library' });
    const swipe = (from: number, to: number) => {
      // Plain Events also run in browsers without a constructible Touch class.
      const start = new Event('touchstart', { bubbles: true });
      Object.defineProperty(start, 'touches', { value: [{ clientX: 100, clientY: from }] });
      fireEvent(heading, start);
      const end = new Event('touchend', { bubbles: true });
      Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 100, clientY: to }] });
      fireEvent(heading, end);
    };
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument();
    swipe(500, 380);
    await waitFor(() => expect(canvas.getByRole('search')).toBeVisible());
    swipe(380, 500);
    await waitFor(() => expect(canvas.queryByRole('search')).not.toBeInTheDocument());
    swipe(500, 380);
    await userEvent.click(within(await canvas.findByRole('search')).getByRole('button', { name: 'Search your books' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    const search = within(dialog).getByRole('searchbox', { name: 'Search your books' });
    await expect(search).toHaveFocus();
    await expect(canvas.queryByRole('heading', { name: 'Library' })).not.toBeInTheDocument();
    await userEvent.type(search, 'c');
    await expect(within(dialog).getByRole('status')).toHaveTextContent('Type at least two characters');
    await userEvent.type(search, 'hambers');
    await expect(within(dialog).getByRole('button', { name: 'A Psalm for the Wild-Built Becky Chambers' })).toBeVisible();
    await expect(within(dialog).getByRole('status')).toHaveTextContent('1 result');
    await userEvent.clear(search);
    await userEvent.type(search, 'no matching book');
    await expect(within(dialog).getByText('No books found. Try another search.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('list', { name: 'Library books' }).children).toHaveLength(7);
    await expect(canvas.getAllByRole('button', { name: 'Search your books' })[0]).toHaveFocus();
  },
};
export const SortingAndLayout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list', { name: 'Library books' });
    const titles = () => within(list).getAllByRole('button').map(button => button.textContent);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'title');
    await expect(titles()[1]).toBe('An Atlas of Quiet Places and the People Who Find Them');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'author');
    await expect(titles()[2]).toBe('The Hobbit');
    await userEvent.click(canvas.getByRole('button', { name: 'List view' }));
    await expect(list).toHaveAttribute('data-view', 'list');
    await expect(canvas.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Sort by' }), 'recent');
    await expect(titles()[0]).toBe('A Psalm for the Wild-Built');
  },
};
