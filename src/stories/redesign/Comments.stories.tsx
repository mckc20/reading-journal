import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { CommentsPanel, type PostComment } from '@/components/redesign/CommentsPanel';
import { CommentsDialog } from '@/components/redesign/CommentsDialog';
import { posts, previewCommentAuthor, sampleComments } from './fixtures';

const initialComments = sampleComments['post-1'].slice(0, 2);
function CommentPreview({ initial = initialComments, dialog = false, initiallyOpen = false, fail = false, delay = 0 }: {
  initial?: PostComment[]; dialog?: boolean; initiallyOpen?: boolean; fail?: boolean; delay?: number;
}) {
  const [comments, setComments] = useState(initial);
  async function addComment(content: string) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (fail) throw new Error('Your comment could not be added. Please try again.');
    setComments(current => [...current, { id: crypto.randomUUID(), author: previewCommentAuthor, postedAt: 'Just now', content }]);
  }
  const props = { comments, currentUser: previewCommentAuthor, onAddComment: addComment };
  return dialog ? <CommentsDialog {...props} post={posts[0]} initiallyOpen={initiallyOpen} /> : <CommentsPanel {...props} />;
}

const meta = {
  title: 'Redesign/Comments',
  parameters: { docs: { description: { component: 'Comments surface from the PDF, with fictional authors and local submission. Enter or the arrow posts a comment. The dialog slides up from the bottom over a clear background. On mobile, drag the handle up to expand only as far as the comments need, capped below the top bar; drag down to close. Arrow Up expands when the handle is focused. At 768px and wider a close button replaces the handle. Escape also dismisses it. Reduced motion skips the slides. Submitted comments last until reload; an unsent draft is discarded when the dialog closes. Inline examples show the panel without its dialog behavior.' } } },
  decorators: [(Story) => <div style={{ width: 'min(390px, calc(100vw - 32px))' }}><Story /></div>],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <CommentPreview /> };
export const Empty: Story = { render: () => <CommentPreview initial={[]} /> };
export const LongThread: Story = { render: () => <CommentPreview initial={Array.from({ length: 18 }, (_, index) => ({ ...initialComments[index % 2], id: `long-${index}` }))} /> };
export const Dialog: Story = { render: () => <CommentPreview dialog /> };
export const DialogOpen: Story = { render: () => <CommentPreview dialog initiallyOpen /> };
export const LongThreadDialog: Story = { render: () => <CommentPreview dialog initiallyOpen initial={Array.from({ length: 18 }, (_, index) => ({ ...initialComments[index % 2], id: `dialog-long-${index}` }))} /> };
export const ContentSizedDialog: Story = { render: () => <CommentPreview dialog initiallyOpen initial={Array.from({ length: 6 }, (_, index) => ({ ...initialComments[index % 2], id: `dialog-fit-${index}` }))} /> };
export const ExpandOnMobile: Story = {
  render: LongThreadDialog.render,
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
    const handle = dialog.querySelector<HTMLButtonElement>('.rj-comments-drag-handle')!;
    if (getComputedStyle(handle).display === 'none') {
      await expect(within(dialog).getByRole('button', { name: 'Close comments' })).toBeVisible();
      return;
    }
    const before = dialog.getBoundingClientRect().height;
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(dialog).toHaveAttribute('data-expanded', 'true'));
    await waitFor(() => expect(dialog.getBoundingClientRect().height).toBeGreaterThanOrEqual(before));
    await waitFor(() => expect(dialog.getBoundingClientRect().top).toBeLessThanOrEqual(95));
  },
};
export const SwipeUpToExpand: Story = {
  render: LongThreadDialog.render,
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
    const handle = dialog.querySelector<HTMLButtonElement>('.rj-comments-drag-handle')!;
    if (getComputedStyle(handle).display === 'none') return;
    const { x, y, width } = handle.getBoundingClientRect();
    const initialTop = dialog.getBoundingClientRect().top;
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { clientX: x + width / 2, clientY: y + 12 } },
      { target: handle, coords: { clientX: x + width / 2, clientY: y - 88 } },
      { keys: '[/MouseLeft]', target: handle },
    ]);
    // Touch-generated clicks may have detail=0, just like keyboard activation.
    fireEvent.click(handle, { detail: 0 });
    await waitFor(() => expect(dialog).toHaveAttribute('data-expanded', 'true'));
    // Check the motion itself, not only its final position: releasing must never
    // replay the entrance and jump the sheet down to the bottom of the viewport.
    for (let frame = 0; frame < 24; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await expect(dialog.getBoundingClientRect().top).toBeLessThanOrEqual(initialTop + 2);
    }
    await expect(dialog).toBeVisible();
    await waitFor(() => expect(dialog.getBoundingClientRect().top).toBeLessThanOrEqual(95));
  },
};
export const DragToDismiss: Story = {
  render: () => <CommentPreview dialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'View comments' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await Promise.all(dialog.getAnimations().map(animation => animation.finished));
    const handle = dialog.querySelector<HTMLButtonElement>('.rj-comments-drag-handle')!;
    if (getComputedStyle(handle).display === 'none') {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close comments' }));
      await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
      await expect(trigger).toHaveFocus();
      return;
    }
    const { x, y, width } = handle.getBoundingClientRect();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { clientX: x + width / 2, clientY: y + 12 } },
      { target: handle, coords: { clientX: x + width / 2, clientY: y + 22 } },
      { keys: '[/MouseLeft]', target: handle },
    ]);
    await expect(dialog).toBeVisible();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { clientX: x + width / 2, clientY: y + 12 } },
      { target: handle, coords: { clientX: x + width / 2, clientY: y + 172 } },
      { keys: '[/MouseLeft]', target: handle },
    ]);
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};
export const AddComment: Story = {
  render: () => <CommentPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.type(input, 'I would love to read this next.');
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }));
    await expect(canvas.getByText('I would love to read this next.')).toBeVisible();
    await expect(input).toHaveValue('');
    await waitFor(() => expect(input).toHaveFocus());
  },
};
export const SubmitError: Story = {
  render: () => <CommentPreview fail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), 'Keep this draft for another try.');
    await userEvent.keyboard('{Enter}');
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Your comment could not be added. Please try again.');
    await expect(canvas.getByRole('textbox')).toHaveValue('Keep this draft for another try.');
  },
};
export const PostingComment: Story = {
  render: () => <CommentPreview delay={2500} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), 'This looks like a great recommendation.');
    await userEvent.click(canvas.getByRole('button', { name: 'Post comment' }));
    await expect(canvas.getByRole('button', { name: 'Posting comment' })).toBeDisabled();
    await expect(canvas.getByRole('textbox')).toBeDisabled();
    await waitFor(() => expect(canvas.getByText('This looks like a great recommendation.')).toBeVisible(), { timeout: 5000 });
  },
};
