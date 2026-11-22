import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BookDetailsPreview, type DetailPreviewBook } from '@/components/redesign/BookDetailsPreview';
import { ProgressDialog } from '@/components/redesign/ProgressDialog';
import { books } from './fixtures';

const sampleBook: DetailPreviewBook = {
  ...books[0], status: 'Reading', genres: ['Science fiction', 'Cozy fiction'],
  description: 'On a moon where robots once walked away from human society, a tea monk meets an unexpected companion. A gentle journey about finding purpose, listening closely, and making room for rest.',
  format: 'Paperback', source: 'Owned', language: 'English', publicationYear: 2021,
  startedOn: '12 November 2026', readingMinutes: 90,
};
const journal = [{ id: 'note-1', date: '12 November 2026', title: 'A quiet beginning', content: 'I like how the small details make the journey feel unhurried. This is a book I want to take my time with.' }];

function BookDetailsReview({ initialBook = sampleBook, populatedJournal = true, saveMode = 'success' }: {
  initialBook?: DetailPreviewBook; populatedJournal?: boolean; saveMode?: 'success' | 'error' | 'pending';
}) {
  const [book, setBook] = useState(initialBook);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const preview = (action: string) => setNotice(`${action} — preview only.`);
  return <>
    <BookDetailsPreview book={book} entries={populatedJournal ? journal : []} notice={notice}
      onBack={() => preview('Library')} onEdit={() => preview('Edit book')} onAddEntry={() => preview('Add journal entry')}
      onToggleFavorite={() => setBook(current => ({ ...current, favorite: !current.favorite }))}
      onViewAnalytics={() => preview('Reading analytics')} onOpenJournal={() => preview('Book journal')}
      onNavigate={preview} onCreate={destination => preview(`Create ${destination}`)} onNotifications={() => preview('Notifications')}
      onReadingAction={() => {
        if (book.status === 'Finished') { preview('Rereading options'); return; }
        returnFocus.current = document.activeElement as HTMLElement;
        setOpen(true);
      }} />
    <ProgressDialog book={book} open={open} onOpenChange={setOpen} trigger={null} returnFocusTo={returnFocus.current} onSave={async draft => {
      if (saveMode === 'pending') await new Promise<void>(resolve => setTimeout(resolve, 4000));
      if (saveMode === 'error') throw new Error('Your progress could not be saved. Your draft is still here; please try again.');
      // Preview proposal: Start/Resume becomes Reading only after Save. Cancel
      // preserves the original status. Production status/completion rules are open.
      setBook(current => ({ ...current, currentPage: draft.page, status: 'Reading', readingMinutes: (current.readingMinutes ?? 0) + (draft.minutes ?? 0) }));
      setNotice(`Preview saved: page ${draft.page}${draft.minutes ? `, ${draft.minutes} minutes` : ''}. No account data changed.${book.totalPages && draft.page === book.totalPages ? ' Completion options still need a design decision.' : ''}`);
    }} />
  </>;
}

const meta = {
  title: 'Redesign/Book Details', component: BookDetailsReview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Book details inspired by the supplied cover-first reference, using the workshop palette and components. A larger cover leads to title/author, status/rating, compact progress and primary actions. About, Reading Progress and Journal form separate sections; secondary metadata is collapsed and only one journal excerpt is shown. All data is fictional and writes are local. Start/Resume opens progress; Cancel preserves status and Save changes the sample to Reading. Completion, rereading and real persistence remain open. Edit, analytics, journal creation/opening and navigation report intent.' } } },
  args: { initialBook: sampleBook, populatedJournal: true, saveMode: 'success' },
  render: args => <BookDetailsReview key={JSON.stringify(args)} {...args} />,
} satisfies Meta<typeof BookDetailsReview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Reading: Story = {};
export const UpNext: Story = { args: { initialBook: { ...sampleBook, status: 'Up Next', currentPage: 0, startedOn: undefined, readingMinutes: undefined }, populatedJournal: false } };
export const Paused: Story = { args: { initialBook: { ...sampleBook, status: 'Paused' } } };
export const Finished: Story = { args: { initialBook: { ...sampleBook, status: 'Finished', currentPage: 160, rating: 4.5, finishedOn: '16 November 2026', readingMinutes: 245 } } };
export const MissingMetadata: Story = { args: { initialBook: { ...sampleBook, cover: null, totalPages: null, description: undefined, format: undefined, source: undefined, language: undefined, publicationYear: undefined, genres: [], title: 'A very long title about finding a place among the stars and coming home again' }, populatedJournal: false } };
export const LongDescription: Story = {
  args: { initialBook: { ...sampleBook, description: 'A traveler stops at a small tea house on the edge of a forest, hoping to find a little quiet. Instead, an unexpected visitor brings a question that sends them both along a road neither had planned to take.\n\nBetween unfamiliar villages and long afternoons beneath the trees, their conversation grows into a friendship. Each stop asks them to reconsider what a good life might look like, and how much of it can be found in the ordinary moments they usually hurry past.\n\nA gentle fictional synopsis for reviewing longer book descriptions and the Show more interaction.' } },
};
export const ExploreDetails: Story = {
  args: LongDescription.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Owned')).not.toBeVisible();
    await userEvent.click(canvas.getByText('More book details'));
    await expect(canvas.getByText('Owned')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show more' }));
    await expect(canvas.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/A gentle fictional synopsis/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    await expect(canvas.queryByText(/A gentle fictional synopsis/)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Add to Favorites' }));
    await expect(canvas.getByRole('button', { name: 'Remove from Favorites' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'More book actions' }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit book' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Edit book');
  },
};
export const SaveProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update Progress' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: /To what page/ }));
    await userEvent.keyboard('80');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('status')).toHaveTextContent('Preview saved: page 80');
    await expect(canvas.getByLabelText('Reading position')).toHaveTextContent('80 / 160 pages');
  },
};
export const CancelStartReading: Story = {
  args: UpNext.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Start Reading' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: /To what page/ }));
    await userEvent.keyboard('20');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(trigger).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(canvas.getByLabelText('Reading position')).toHaveTextContent('0 / 160 pages');
  },
};
export const ResumeAndSave: Story = {
  args: Paused.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Resume' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: 'Update Progress' })).toBeVisible();
  },
};
export const CompletionReview: Story = {
  parameters: { docs: { description: { story: 'Boundary example: saving the final page updates local progress, but keeps Reading status. The production completion/rating/date flow still needs to be selected.' } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update Progress' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: /To what page/ }));
    await userEvent.keyboard('160');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(canvas.getByRole('status')).toHaveTextContent('Completion options still need a design decision');
    await expect(canvas.getByRole('button', { name: 'Update Progress' })).toBeVisible();
  },
};
export const SaveError: Story = {
  args: { saveMode: 'error' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Update Progress' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    const page = within(dialog).getByRole('spinbutton', { name: /To what page/ });
    await userEvent.click(page); await userEvent.keyboard('80');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Your draft is still here');
    await expect(page).toHaveAttribute('aria-valuenow', '80');
  },
};
export const SavingProgress: Story = {
  args: { saveMode: 'pending' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Update Progress' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};
