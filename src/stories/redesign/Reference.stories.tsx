import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomeShell } from '@/components/redesign/HomeShell';
import { QuickProgress } from '@/components/redesign/RedesignHome';
import { BookShelf, CommunityPost, GoalCard, ReadingBookCard, type HomeBook, type HomePost } from '@/components/redesign/HomeCards';
import { ProgressDialog } from '@/components/redesign/ProgressDialog';
import { SharePostDialog } from '@/components/redesign/SharePostDialog';
import { books, posts } from './fixtures';

const noop = () => {};

/** The PDF combines independent examples: a three-book widget and a one-book detail card. */
function ReferenceBoard() {
  const [selectedId, setSelectedId] = useState(books[1].id);
  const [activeBook, setActiveBook] = useState<HomeBook | null>(null);
  const [activePost, setActivePost] = useState<HomePost | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const recommended = Array.from({ length: 4 }, (_, index) => ({ ...books[0], id: `reference-${index}` }));

  return <div className="rj-redesign rj-pdf-reference">
    <HomeShell navigationPlacement="footer" onNavigate={noop} onCreate={noop} onNotifications={noop}>
      <QuickProgress books={[books[2], books[1], books[3]]} selectedId={selectedId} onSelect={setSelectedId} onRead={book => { returnFocus.current = document.activeElement as HTMLElement; setActiveBook(book); }} onChangeDate={noop} onSession={noop} onEditLogs={noop} />
      <section className="rj-home-section"><h2>Currently Reading</h2><ReadingBookCard book={books[0]} onOpen={noop} /></section>
      <section className="rj-home-section"><h2>Your Goals</h2><GoalCard goal={{ year: 2026, completed: 23, target: 60 }} onOpen={noop} /></section>
      <section className="rj-home-section"><h2>Recommended for you</h2><BookShelf books={recommended} onOpen={noop} /></section>
      <section className="rj-home-section"><h2>From others</h2><div className="rj-posts">{posts.map(post => <CommunityPost key={post.id} post={post} onLike={noop} onComments={noop} onOpen={noop} onProfile={noop} onChat={noop} onShare={() => { returnFocus.current = document.activeElement as HTMLElement; setActivePost(post); }} />)}</div></section>
    </HomeShell>
    {activeBook && <ProgressDialog book={activeBook} open trigger={null} returnFocusTo={returnFocus.current} onOpenChange={open => { if (!open) setActiveBook(null); }} onSave={async () => {}} />}
    {activePost && <SharePostDialog post={activePost} open trigger={null} returnFocusTo={returnFocus.current} onOpenChange={open => { if (!open) setActivePost(null); }} onShare={async () => {}} />}
  </div>;
}

const meta = {
  title: 'Redesign/PDF Reference',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'A 390px reference board matching the main light Home concept, with sample book counts kept independent as in the PDF. Footer controls remain in document flow to compare the full composition. Use Home stories for actual responsive layout and local interaction state. Personal photos and prose are replaced with fictional fixtures.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Home: Story = { render: () => <ReferenceBoard /> };
