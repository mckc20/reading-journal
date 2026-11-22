import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { BookFormPreview, type BookFormDraft, type BookLookupResult } from '@/components/redesign/BookFormPreview';
import { books } from './fixtures';

const example: BookFormDraft = { title: 'A Psalm for the Wild-Built', authors: ['Becky Chambers'], genres: ['Science fiction', 'Cozy fiction'], cover_url: books[0].cover, status: 'To Read', total_pages: 160, source: 'Owned', format: 'Paperback', language: 'English', isbn: '9781250236210', publication_date: '2021-01-01', series_id: 'monk', volume_number: 1, description: 'A quiet journey through the woods, and a conversation about what it means to have enough.' };
const catalog: BookLookupResult[] = [{ ...example, id: 'psalm' }, { id: 'circus', title: 'The Night Circus', authors: ['Erin Morgenstern'], genres: ['Fantasy'], cover_url: books[2].cover, isbn: '9780307744432', total_pages: 387, language: 'English', publication_date: '2011-01-01' }];
interface ReviewProps { mode: 'add' | 'edit'; populated?: boolean; behavior?: 'success' | 'error' | 'pending'; initiallyOpen?: boolean; lookupBehavior?: 'success' | 'error'; initialStatus?: BookFormDraft['status'] }
function BookFormReview({ mode, populated = false, behavior = 'success', initiallyOpen = true, lookupBehavior = 'success', initialStatus }: ReviewProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  const [saved, setSaved] = useState<BookFormDraft | undefined>(mode === 'edit' ? { ...example, status: initialStatus ?? example.status } : undefined);
  const [notice, setNotice] = useState('');
  return <div className="rj-redesign rj-book-form-demo"><h1>Your next chapter</h1><p>A place for the books you want to remember.</p><Button ref={trigger} onClick={() => { setNotice(''); setOpen(true); }}>{mode === 'edit' ? 'Edit book' : 'Add a book'}</Button>
    {notice && <p role="status">{notice}</p>}
    {saved && <p aria-label="Saved book">{saved.title} · {saved.authors.join(', ')} · {saved.status} · {saved.genres?.join(', ')}{saved.series_id ? ` · Series volume ${saved.volume_number ?? 'unknown'}` : ''}</p>}
    {open && <BookFormPreview open mode={mode} returnFocusTo={trigger.current} initialBook={saved ?? (populated ? { ...example, status: initialStatus ?? example.status } : initialStatus ? { title: '', authors: [], status: initialStatus } : undefined)}
      authorOptions={['Becky Chambers', 'Erin Morgenstern', 'Susanna Clarke']} genreOptions={['Science fiction', 'Cozy fiction', 'Fantasy', 'Mystery']} seriesOptions={[{ id: 'monk', name: 'Monk & Robot' }, { id: 'wayfarers', name: 'Wayfarers' }]}
      onLookup={async (query, searchMode) => { await new Promise(resolve => setTimeout(resolve, 200)); if (lookupBehavior === 'error') throw new Error('Sample lookup failure'); return catalog.filter(book => searchMode === 'isbn' ? book.isbn === query : book.title.toLowerCase().includes(query.toLowerCase())); }}
      onScanISBN={async () => { await new Promise(resolve => setTimeout(resolve, 200)); return '9781250236210'; }}
      onOpenChange={value => { setOpen(value); if (!value) setNotice(current => current || 'Changes discarded. No account data changed.'); }} onSave={async draft => {
      if (behavior === 'pending') return new Promise<void>(() => {});
      await new Promise(resolve => setTimeout(resolve, 250));
      if (behavior === 'error') throw new Error('The connection was interrupted. Try saving again.');
      setSaved(draft); setNotice(`Preview saved: ${draft.title}. No account data changed.`);
    }} />}
  </div>;
}
const meta = {
  title: 'Redesign/Book Form', component: BookFormReview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Expanded Add/Edit Book workshop using the existing app form as a field reference. Includes ISBN/title lookup, barcode action, local cover selection, author/genre chips, status, language, pages, series/volume, secondary publication/format/source/ISBN and description. Reading dates/current page and Wishlist price/link appear by status. Catalog lookup and barcode scanning are simulated with injected callbacks and public book fixtures; no camera or network request occurs. Local image previews stay in this browser and are not uploaded. Using a catalog result replaces metadata but preserves status/source/series. All saves are local; production status transitions and relational persistence remain separate work. Header/actions remain stationary around one scroll area; cancellation discards drafts and pending saves block dismissal.' } } },
  args: { mode: 'add', initiallyOpen: true },
  render: args => <BookFormReview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof BookFormReview>;
export default meta;
type Story = StoryObj<typeof meta>;
const dialogFor = async (canvasElement: HTMLElement) => within(await within(canvasElement.ownerDocument.body).findByRole('dialog'));
export const AddBook: Story = {};
export const Populated: Story = { args: { populated: true } };
export const EditBook: Story = { args: { mode: 'edit' } };
export const Wishlist: Story = { args: { populated: true, initialStatus: 'Wishlist' } };
export const Reading: Story = { args: { populated: true, initialStatus: 'Reading' } };
export const ISBNLookup: Story = { play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.selectOptions(dialog.getByLabelText('Reading status'), 'Up Next');
  await userEvent.click(dialog.getByRole('button', { name: 'Scan ISBN barcode' }));
  await waitFor(() => expect(dialog.getByLabelText('ISBN to look up')).toHaveValue('9781250236210'));
  await userEvent.click(dialog.getByRole('button', { name: 'Look up' }));
  await userEvent.click(await dialog.findByRole('button', { name: 'Use A Psalm for the Wild-Built' }));
  await expect(dialog.getByLabelText('Title')).toHaveValue(example.title);
  await expect(dialog.getByRole('button', { name: 'Remove author Becky Chambers' })).toBeVisible();
  await expect(dialog.getByLabelText('Total pages')).toHaveValue('160');
  await expect(dialog.getByLabelText('Reading status')).toHaveValue('Up Next');
} };
export const TitleLookup: Story = { play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByRole('radio', { name: 'Book title' }));
  await userEvent.type(dialog.getByLabelText('Book title to search'), 'Night{Enter}');
  await userEvent.click(await dialog.findByRole('button', { name: 'Use The Night Circus' }));
  await expect(dialog.getByLabelText('Title')).toHaveValue('The Night Circus');
  await expect(dialog.getByRole('button', { name: 'Remove genre Fantasy' })).toBeVisible();
  await expect(within(canvasElement).queryByLabelText('Saved book')).not.toBeInTheDocument();
} };
export const LookupNoResults: Story = { play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByRole('radio', { name: 'Book title' }));
  await userEvent.type(dialog.getByLabelText('Book title to search'), 'A missing title{Enter}');
  await waitFor(() => expect(dialog.getByRole('status')).toHaveTextContent('No books found.'));
  await expect(dialog.getByLabelText('Title')).toBeEnabled();
} };
export const LookupError: Story = { args: { lookupBehavior: 'error' }, play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.type(dialog.getByLabelText('Title'), 'Keep my draft');
  await userEvent.type(dialog.getByLabelText('ISBN to look up'), '9781250236210');
  await userEvent.click(dialog.getByRole('button', { name: 'Look up' }));
  await expect(await dialog.findByRole('alert')).toHaveTextContent('Search couldn’t load.');
  await expect(dialog.getByLabelText('Title')).toHaveValue('Keep my draft');
} };
export const MetadataAndCover: Story = { args: { populated: true }, play: async ({ canvasElement }) => {
  let dialog = await dialogFor(canvasElement);
  const image = await (await fetch(books[0].cover!)).blob();
  await userEvent.upload(dialog.getByLabelText('Book cover'), new File([image], 'sample-cover.jpg', { type: 'image/jpeg' }));
  await waitFor(() => expect(dialog.getByRole('img', { name: example.title })).toHaveAttribute('src', expect.stringMatching(/^data:image\/jpeg/)));
  await userEvent.type(dialog.getByLabelText('Genres'), 'Mystery');
  await userEvent.click(dialog.getByRole('button', { name: 'Add genre' }));
  await userEvent.selectOptions(dialog.getByLabelText('Series'), 'wayfarers');
  await userEvent.clear(dialog.getByLabelText('Volume number'));
  await userEvent.type(dialog.getByLabelText('Volume number'), '2');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Preview saved:'));
  await expect(canvas.getByLabelText('Saved book')).toHaveTextContent('Mystery');
  await expect(canvas.getByLabelText('Saved book')).toHaveTextContent('Series volume 2');
  await userEvent.click(canvas.getByRole('button', { name: 'Add a book' }));
  dialog = await dialogFor(canvasElement);
  await expect(dialog.getByLabelText('Series')).toHaveValue('wayfarers');
  await expect(dialog.getByRole('button', { name: 'Remove genre Mystery' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: example.title })).toHaveAttribute('src', expect.stringMatching(/^data:image\/jpeg/));
} };
export const WishlistDetails: Story = { args: Wishlist.args, play: async ({ canvasElement }) => {
  let dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByText('Secondary Information'));
  await userEvent.type(dialog.getByLabelText('Price'), '-3');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await waitFor(() => expect(dialog.getByLabelText('Price')).toHaveFocus());
  await expect(dialog.getByText('Enter a price of zero or more.')).toBeVisible();
  await userEvent.clear(dialog.getByLabelText('Price'));
  await userEvent.type(dialog.getByLabelText('Price'), '18.50');
  await userEvent.type(dialog.getByLabelText('Purchase link'), 'bookstore');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await waitFor(() => expect(dialog.getByLabelText('Purchase link')).toHaveFocus());
  await userEvent.clear(dialog.getByLabelText('Purchase link'));
  await userEvent.type(dialog.getByLabelText('Purchase link'), 'https://example.com/books/psalm');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Preview saved:'));
  await userEvent.click(canvas.getByRole('button', { name: 'Add a book' }));
  dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByText('Secondary Information'));
  await expect(dialog.getByLabelText('Price')).toHaveValue('18.5');
  await expect(dialog.getByLabelText('Purchase link')).toHaveValue('https://example.com/books/psalm');
} };
export const ReadingDates: Story = { args: { populated: true, initialStatus: 'Finished' }, play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  fireEvent.change(dialog.getByLabelText('Date started'), { target: { value: '2026-11-12' } });
  fireEvent.change(dialog.getByLabelText('Date finished'), { target: { value: '2026-11-10' } });
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await expect(dialog.getByText('The finish date must be on or after the start date.')).toBeVisible();
  await expect(dialog.getByLabelText('Date finished')).toHaveFocus();
} };
export const Validation: Story = { play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await expect(dialog.getByLabelText('Title')).toHaveFocus();
  await expect(dialog.getByText('Enter a book title.')).toBeVisible();
  await expect(dialog.getByText('Enter at least one author.')).toBeVisible();
  await userEvent.type(dialog.getByLabelText('Title'), 'A book for tomorrow');
  await userEvent.type(dialog.getByLabelText('Author', { exact: true }), 'Alex Rivers');
  await userEvent.type(dialog.getByLabelText('Total pages'), '-1');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await expect(dialog.getByLabelText('Total pages')).toHaveFocus();
  await expect(dialog.getByText('Enter a positive whole number of pages, or leave this blank.')).toBeVisible();
} };
export const SaveBook: Story = { play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.type(dialog.getByLabelText('Title'), 'A book for tomorrow');
  await userEvent.type(dialog.getByLabelText('Author', { exact: true }), 'Alex Rivers; Sam Brooks');
  await userEvent.selectOptions(dialog.getByLabelText('Reading status'), 'Up Next');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Preview saved: A book for tomorrow'));
  await expect(canvas.getByLabelText('Saved book')).toHaveTextContent('Alex Rivers, Sam Brooks · Up Next');
  await expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).not.toBeInTheDocument();
} };
export const CancelEdits: Story = { args: { mode: 'edit', initiallyOpen: false }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Edit book' });
  await userEvent.click(trigger);
  let dialog = await dialogFor(canvasElement);
  await userEvent.clear(dialog.getByLabelText('Title'));
  await userEvent.type(dialog.getByLabelText('Title'), 'An unsaved title');
  await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(canvas.getByLabelText('Saved book')).toHaveTextContent(example.title);
  await userEvent.click(trigger);
  dialog = await dialogFor(canvasElement);
  await expect(dialog.getByLabelText('Title')).toHaveValue(example.title);
} };
export const SaveError: Story = { args: { populated: true, behavior: 'error' }, play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.clear(dialog.getByLabelText('Title'));
  await userEvent.type(dialog.getByLabelText('Title'), 'Keep this draft');
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await waitFor(() => expect(dialog.getByRole('alert')).toHaveTextContent('Your edits are still here.'));
  await expect(dialog.getByLabelText('Title')).toHaveValue('Keep this draft');
  await expect(dialog.getByRole('button', { name: 'Add book' })).toBeEnabled();
} };
export const Saving: Story = { args: { populated: true, behavior: 'pending' }, play: async ({ canvasElement }) => {
  const dialog = await dialogFor(canvasElement);
  await userEvent.click(dialog.getByRole('button', { name: 'Add book' }));
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  await expect(within(canvasElement.ownerDocument.body).getByRole('dialog')).toBeVisible();
} };
