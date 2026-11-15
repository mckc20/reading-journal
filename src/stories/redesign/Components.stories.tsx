import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ReadingBookCard, BookShelf, GoalCard, PlanCard, CommunityPost, type HomeBook } from '@/components/redesign/HomeCards';
import { QuickProgress } from '@/components/redesign/RedesignHome';
import { AddLauncher } from '@/components/redesign/HomeShell';
import { ProgressDialog } from '@/components/redesign/ProgressDialog';
import { SharePostDialog } from '@/components/redesign/SharePostDialog';
import { books, posts } from './fixtures';

const meta = { title: 'Redesign/Components', parameters: { layout: 'centered' }, decorators: [(Story) => <div style={{ width: 'min(350px, calc(100vw - 48px))' }}><Story /></div>] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};
export const ReadingCard: Story = { render: () => <ReadingBookCard book={books[0]} onOpen={noop} /> };
export const Recommendations: Story = { render: () => <BookShelf books={books} onOpen={noop} /> };
export const Goal: Story = { render: () => <GoalCard goal={{ year: 2026, completed: 23, target: 60 }} onOpen={noop} /> };
export const StartPlan: Story = { render: () => <PlanCard book={books[3]} kind="start" date="2026-11-20" onOpen={noop} /> };
export const FinishPlan: Story = { render: () => <PlanCard book={books[0]} kind="finish" date="2026-11-30" onOpen={noop} /> };
export const Post: Story = { render: () => <CommunityPost post={posts[0]} onLike={noop} onComments={noop} onShare={noop} onOpen={noop} onProfile={noop} onChat={noop} /> };
export const QuotePost: Story = { render: () => <CommunityPost post={posts[1]} onLike={noop} onComments={noop} onShare={noop} onOpen={noop} onProfile={noop} onChat={noop} /> };
export const AddMenu: Story = { render: () => <AddLauncher onCreate={noop} /> };
export const AddMenuOpen: Story = {
  render: () => <AddLauncher onCreate={noop} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add' }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await waitFor(() => expect(within(menu).getByText('Add a book', { exact: true })).toBeVisible());
    await Promise.all(menu.getAnimations({ subtree: true }).map(animation => animation.finished));
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  },
};
function ProgressWidget({ reference = false }: { reference?: boolean }) {
  const [selectedId, setSelectedId] = useState(reference ? books[1].id : books[0].id);
  const [activeBook, setActiveBook] = useState<HomeBook | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  return <>
    <QuickProgress books={reference ? [books[2], books[1], books[3]] : books.slice(0, 3)} selectedId={selectedId} onSelect={setSelectedId} onRead={book => { returnFocus.current = document.activeElement as HTMLElement; setActiveBook(book); }} onChangeDate={noop} onSession={noop} onEditLogs={noop} />
    {activeBook && <ProgressDialog book={activeBook} open trigger={null} returnFocusTo={returnFocus.current} onOpenChange={open => { if (!open) setActiveBook(null); }} onSave={async () => {}} />}
  </>;
}
export const ReadingWidget: Story = { render: () => <ProgressWidget /> };
function ReferenceProgressWidget() { return <ProgressWidget reference />; }
export const ReadingWidgetPdfReference: Story = { render: () => <ReferenceProgressWidget /> };
export const ReadingWidgetMoreActions: Story = {
  render: () => <ReferenceProgressWidget />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More reading actions' });
    const initialColor = getComputedStyle(trigger).color;
    const circleWidth = getComputedStyle(trigger, '::before').width;
    await userEvent.click(trigger);
    await within(canvasElement.ownerDocument.body).findByRole('menu');
    await waitFor(() => expect(getComputedStyle(trigger).color).toBe(initialColor));
    await expect(getComputedStyle(trigger, '::before').content).not.toBe('none');
    await expect(getComputedStyle(trigger, '::before').backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(trigger, '::before').width).toBe(circleWidth);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
  },
};
export const ReadingWidgetClickSlides: Story = {
  render: () => <ReferenceProgressWidget />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByRole('group', { name: 'Choose a book to update' });
    await waitFor(() => expect(strip.scrollLeft).toBeGreaterThan(0));
    const start = strip.scrollLeft;
    const positions: number[] = [];
    const cover = canvas.getByRole('button', { name: 'Update Progress for The Night Circus' });
    const frame = canvasElement.querySelector('.rj-quick-selection-frame')!;
    let openedBeforeCentered = false;
    let animationFrame = 0;
    function sample() {
      positions.push(strip.scrollLeft);
      if (canvasElement.ownerDocument.querySelector('[role="dialog"]')) {
        const bookBounds = cover.getBoundingClientRect();
        const frameBounds = frame.getBoundingClientRect();
        if (Math.abs(bookBounds.x + bookBounds.width / 2 - frameBounds.x - frameBounds.width / 2) > 1) openedBeforeCentered = true;
      }
      animationFrame = requestAnimationFrame(sample);
    }
    animationFrame = requestAnimationFrame(sample);
    try {
      await userEvent.click(cover);
      await waitFor(() => expect(strip.scrollLeft).toBeCloseTo(0, 0));
      await expect(cover).toHaveAttribute('aria-pressed', 'true');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await expect(positions.some(position => position > 0 && position < start)).toBe(true);
      }
      const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
      await waitFor(() => expect(within(dialog).getByText('The Night Circus', { exact: true })).toBeVisible());
      await expect(openedBeforeCentered).toBe(false);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await expect(cover).toHaveFocus();
    } finally { cancelAnimationFrame(animationFrame); }
  },
};
export const Progress: Story = { render: () => <ProgressDialog book={books[1]} onSave={async () => {}} /> };
export const ProgressPdfReference: Story = { render: () => <ProgressDialog book={books[1]} initialDraft={{ page: 250, minutes: 65 }} initiallyOpen onSave={async () => {}} /> };
export const ProgressSaveError: Story = {
  render: () => <ProgressDialog book={books[1]} onSave={async () => { throw new Error('Unable to save progress. Your changes are still here; try again.'); }} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Update Progress' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to save progress');
    await expect(within(dialog).getByRole('spinbutton', { name: /To what page/ })).toHaveAttribute('aria-valuenow', '246');
  },
};
export const ProgressSaving: Story = { render: () => <ProgressDialog book={books[1]} onSave={() => new Promise<void>(() => {})} /> };
export const ProgressUnknownTotal: Story = { render: () => <ProgressDialog book={{ ...books[0], totalPages: null }} onSave={async () => {}} /> };
export const SharePost: Story = { render: () => <SharePostDialog post={posts[0]} onShare={async () => {}} /> };
export const SharePostPdfReference: Story = { render: () => <SharePostDialog post={posts[0]} initiallyOpen onShare={async () => {}} /> };
export const SharePostError: Story = {
  render: () => <SharePostDialog post={posts[0]} onShare={async () => { throw new Error('Unable to share this post. Please try again.'); }} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Share post' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Share by email' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Share' }));
    await expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to share this post');
    await expect(within(dialog).getByRole('button', { name: 'Share by email' })).toHaveAttribute('aria-pressed', 'true');
  },
};
