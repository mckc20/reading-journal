import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { RedesignHome, type RedesignHomeProps } from '@/components/redesign/RedesignHome';
import { ProgressDialog } from '@/components/redesign/ProgressDialog';
import { SharePostDialog } from '@/components/redesign/SharePostDialog';
import type { HomeBook, HomePost } from '@/components/redesign/HomeCards';
import { books, posts, previewCommentAuthor } from './fixtures';
import { CommentsDialog } from '@/components/redesign/CommentsDialog';
import { useCommentPreview } from './useCommentPreview';

function HomeReview(args: RedesignHomeProps) {
  const [reading, setReading] = useState(args.reading);
  const [community, setCommunity] = useState(args.posts);
  const [activeBook, setActiveBook] = useState<HomeBook | null>(null);
  const [sharedPost, setSharedPost] = useState<HomePost | null>(null);
  const { comments, addComment } = useCommentPreview();
  const [commentsPost, setCommentsPost] = useState<HomePost | null>(null);
  const [notice, setNotice] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const preview = (message: string) => setNotice(`${message} — preview only`);
  return <>
    <RedesignHome {...args} reading={reading} posts={community}
      onRead={book => { returnFocus.current = document.activeElement as HTMLElement; setActiveBook(book); }}
      onChangeDate={book => preview(`Change date/time for ${book.title}`)}
      onSession={book => preview(`Timed session for ${book.title}`)} onEditLogs={book => preview(`Edit logs for ${book.title}`)}
      onOpenBook={book => preview(`Book details: ${book.title}`)} onGoal={() => preview('Goals and plans')}
      onNavigate={destination => preview(destination)} onCreate={destination => preview(`Create ${destination}`)}
      onNotifications={() => preview('Notifications')} onRetry={() => preview('Retry requested')}
      onPostAction={(post, action) => {
        if (action === 'like') setCommunity(current => current.map(item => item.id === post.id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item));
        else if (action === 'share') { returnFocus.current = document.activeElement as HTMLElement; setSharedPost(post); }
        else if (action === 'comments') { returnFocus.current = document.activeElement as HTMLElement; setCommentsPost(post); }
        else preview(`${action}: ${post.author}’s post`);
      }}
    />
    {activeBook && <ProgressDialog key={activeBook.id} book={activeBook} open onOpenChange={open => { if (!open) setActiveBook(null); }} trigger={null} returnFocusTo={returnFocus.current} onSave={async draft => {
      setReading(current => current.map(book => book.id === activeBook.id ? { ...book, currentPage: draft.page } : book));
      setNotice(`Preview saved: page ${draft.page}${draft.minutes ? `, ${draft.minutes} minutes` : ''}. No account data changed.`);
    }} />}
    {sharedPost && <SharePostDialog key={sharedPost.id} post={sharedPost} open trigger={null} returnFocusTo={returnFocus.current} onOpenChange={open => { if (!open) setSharedPost(null); }} onShare={async destination => {
      preview(`Share ${sharedPost.author}’s post via ${destination}`);
    }} />}
    {commentsPost && <CommentsDialog post={commentsPost} comments={comments[commentsPost.id] ?? []} currentUser={previewCommentAuthor} open trigger={null} returnFocusTo={returnFocus.current} onOpenChange={open => { if (!open) setCommentsPost(null); }} onAddComment={async content => {
      await addComment(commentsPost.id, content);
      setCommunity(current => current.map(post => post.id === commentsPost.id ? { ...post, comments: post.comments + 1 } : post));
    }} />}
    {notice && <div role="status" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: 'min(90%, 520px)', padding: 12, borderRadius: 12, background: '#21150f', color: 'white', fontSize: 13 }} onClick={() => setNotice('')}>{notice}</div>}
  </>;
}

const noop = () => {};
const meta = {
  title: 'Redesign/Home', component: RedesignHome,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Home from the supplied Modern Redesign PDF. Data and saves are local simulations. Phone follows the reference; wider layouts are a proposed adaptation. Navigation and new feature destinations report their intent only.' } } },
  args: { reading: [books[0]], recommendations: [books[4], books[3], books[1], books[2]], goal: { year: 2026, completed: 23, target: 60 }, posts, onRetry: noop, onRead: noop, onChangeDate: noop, onSession: noop, onEditLogs: noop, onOpenBook: noop, onGoal: noop, onNavigate: noop, onCreate: noop, onNotifications: noop, onPostAction: noop },
  render: args => <HomeReview key={JSON.stringify([args.reading, args.posts])} {...args} />,
} satisfies Meta<typeof RedesignHome>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleBook: Story = {};
export const SeveralBooks: Story = { args: { reading: books.slice(0, 3) } };
export const UpNext: Story = {
  args: { upNext: [books[3], books[4], books[2]].map(book => ({ ...book, currentPage: 0, status: 'Up Next' as const })) },
  parameters: { docs: { description: { story: 'Up Next books appear immediately below Your Goals without cover badges: in the main flow on phone and beneath the goals card in the wider sidebar. They stay separate from Currently Reading and the progress carousel.' } } },
};
export const SlidingReadingSelection: Story = {
  args: { reading: books.slice(0, 3) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const strip = canvas.getByRole('group', { name: 'Choose a book to update' });
    const frame = canvasElement.querySelector('.rj-quick-selection-frame')!;
    const before = frame.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollWidth, behavior: 'auto' });
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Update Progress for The Night Circus' })).toHaveAttribute('aria-pressed', 'true'));
    const after = frame.getBoundingClientRect();
    await expect(after.x).toBeCloseTo(before.x, 1);
    await expect(after.y).toBeCloseTo(before.y, 1);
    await userEvent.click(canvas.getByRole('button', { name: 'Update Progress' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText('The Night Circus', { exact: true })).toBeVisible());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  },
};
export const Empty: Story = { args: { reading: [], recommendations: [], posts: [], goal: undefined } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please check your connection and try again.' } };
export const MissingCoverAndPages: Story = { args: { reading: [{ ...books[0], cover: null, totalPages: null, title: 'A very long book title that wraps across several lines in a narrow reading card' }] } };
export const CompletedGoal: Story = { args: { goal: { year: 2026, completed: 65, target: 60 } } };
export const EnhancedContrast: Story = {
  decorators: [(Story) => <div className="rj-contrast-enhanced"><Story /></div>],
  parameters: { docs: { description: { story: 'Optional darker blue/rose backing for white text. The default stories preserve the PDF colors; this variant is a separate palette proposal for contrast review.' } } },
};
export const SaveProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update Progress' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    const page = within(dialog).getByRole('spinbutton', { name: /What page did you read up to/ });
    await userEvent.click(page); await userEvent.keyboard('80');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: 'Hours' }));
    await userEvent.keyboard('1');
    await userEvent.click(within(dialog).getByRole('spinbutton', { name: 'Minutes' }));
    await userEvent.keyboard('5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expect(canvas.getByText('You’re 50% through the book')).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('page 80, 65 minutes');
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
export const CancelProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Update Progress' });
    await userEvent.click(trigger);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    const page = within(dialog).getByRole('spinbutton', { name: /What page did you read up to/ });
    await userEvent.click(page); await userEvent.keyboard('80');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByText('You’re 40% through the book')).toBeVisible();
    await expect(trigger).toHaveFocus();
  },
};
export const SharePost: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getAllByRole('button', { name: 'Share post' })[0];
    await userEvent.click(trigger);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(within(dialog).getByText('Alex Rivers', { exact: true })).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy a link' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Share' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('via link — preview only');
    await expect(trigger).toHaveFocus();
  },
};

export const CommentOnPost: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '3 comments; open comments' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Adding this to my reading list.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Post comment' }));
    await expect(within(dialog).getByText('Adding this to my reading list.')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.getByRole('button', { name: '4 comments; open comments' })).toHaveFocus());
    await userEvent.click(canvas.getByRole('button', { name: '4 comments; open comments' }));
    await expect(within(await within(canvasElement.ownerDocument.body).findByRole('dialog')).getByText('Adding this to my reading list.')).toBeVisible();
  },
};
