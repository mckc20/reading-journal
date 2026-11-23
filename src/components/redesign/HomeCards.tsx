import { ArrowRight, Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { BookCover } from '@/components/reading-journal/BookCover';
import { BookProgress, getBookProgress } from '@/components/reading-journal/BookProgress';
import { useShelfDrag } from '@/hooks/useShelfDrag';
import type { BookStatus } from '@/types';

/** Presentation data only: these components do not fetch or save account data. */
export interface HomeBook {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
  currentPage: number;
  totalPages?: number | null;
  status?: BookStatus;
}

export function ReadingBookCard({ book, onOpen }: { book: HomeBook; onOpen: (book: HomeBook) => void }) {
  const progress = getBookProgress(book.currentPage, book.totalPages);
  return (
    <button className="rj-reading-card" onClick={() => onOpen(book)}>
      <BookCover src={book.cover} title={book.title} size="fill" showFallbackTitle decorative />
      <span className="rj-reading-card-copy">
        <span className="rj-book-title">{book.title}</span>
        <span className="rj-muted">{book.author}</span>
        <span className="rj-page-count"><span>Current page: {book.currentPage}</span><span>Total pages: {book.totalPages || 'Unknown'}</span></span>
        <span className="rj-progress-copy">{progress === null ? 'Total pages needed to track progress' : `You’re ${progress}% through the book`}</span>
        <BookProgress currentPage={book.currentPage} totalPages={book.totalPages} barClassName="h-1.5" />
      </span>
    </button>
  );
}

type ShelfBook = Pick<HomeBook, 'id' | 'title' | 'cover' | 'status'> & {
  author?: string;
  favorite?: boolean;
  paused?: boolean;
  cornerLabel?: string;
};

export function ShelfBookCard<T extends ShelfBook>({ book, onOpen, showStatus = true }: {
  book: T;
  onOpen: (book: T) => void;
  showStatus?: boolean;
}) {
  return (
    <button type="button" data-shelf-item className="rj-shelf-book" onClick={() => onOpen(book)}>
      <BookCover src={book.cover} title={book.title} status={showStatus ? book.status : undefined} favorite={book.favorite}
        paused={book.paused} cornerLabel={book.cornerLabel} showFallbackTitle decorative />
      <span className="rj-book-title">{book.title}</span>
      {book.author !== undefined && <span className="rj-muted">{book.author}</span>}
      {showStatus && book.status && <span className="sr-only">{book.status}</span>}
      {book.cornerLabel && <span className="sr-only">Volume {book.cornerLabel}</span>}
      {book.favorite && <span className="sr-only">Favorite</span>}
    </button>
  );
}

export function BookShelf<T extends ShelfBook>({ books, onOpen, showStatus = true, label = 'Books' }: {
  books: T[];
  onOpen: (book: T) => void;
  showStatus?: boolean;
  label?: string;
}) {
  const drag = useShelfDrag<HTMLDivElement>();

  return (
    <div className="rj-shelf-frame rj-home-shelf-frame">
      <div {...drag} className="rj-shelf rj-shelf-scroll" tabIndex={0} role="group" aria-label={label}>
        {books.map(book => <ShelfBookCard key={book.id} book={book} onOpen={onOpen} showStatus={showStatus} />)}
      </div>
    </div>
  );
}

export interface ReadingGoal { year: number; completed: number; target: number }

export function GoalCard({ goal, onOpen }: { goal: ReadingGoal; onOpen: () => void }) {
  const percent = goal.target > 0 ? Math.min(100, Math.max(0, goal.completed / goal.target * 100)) : 0;
  return <button className="rj-goal-card" onClick={onOpen}>
    <span className="rj-eyebrow">{goal.year}</span>
    <span className="rj-display">Reading Goal</span>
    <span className="rj-card-band" aria-hidden="true" />
    <span className="rj-goal-count"><strong>{goal.completed}</strong><span className="rj-goal-target">/{goal.target}</span><span className="rj-goal-unit">books</span></span>
    <svg className="rj-goal-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--rj-light-yellow)" strokeWidth="16" />
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--rj-gold)" strokeWidth="16" pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 60 60)" strokeLinecap="round" />
    </svg>
    <ArrowRight className="rj-card-arrow" size={20} aria-hidden="true" />
  </button>;
}

export function PlanCard({ book, kind, date, onOpen }: { book: HomeBook; kind: 'start' | 'finish'; date: string; onOpen: () => void }) {
  const plannedDate = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(plannedDate);
  const monthAndYear = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(plannedDate);
  return <button className="rj-plan-card" onClick={onOpen}>
    <span className="rj-eyebrow">You are planning to {kind}</span>
    <span className="rj-display">{book.title}</span>
    <span className="rj-card-band" aria-hidden="true" />
    <span className="rj-plan-date"><span className="rj-eyebrow">on</span><time dateTime={date}><span className="rj-plan-day">{day}.</span> <span>{monthAndYear}</span></time></span>
    <BookCover src={book.cover} title={book.title} />
    <ArrowRight className="rj-card-arrow" size={20} aria-hidden="true" />
  </button>;
}

export interface HomePost {
  id: string;
  author: string;
  initials: string;
  postedAt: string;
  content: string;
  quote?: boolean;
  attribution?: string;
  book: HomeBook;
  likes: number;
  comments: number;
  liked?: boolean;
}

export function CommunityPost({ post, onLike, onComments, onShare, onOpen, onProfile, onChat }: {
  post: HomePost; onLike: () => void; onComments: () => void; onShare: () => void; onOpen: () => void;
  onProfile: () => void; onChat: () => void;
}) {
  return <article className="rj-post">
    <div className="rj-post-body">
      <header><span className="rj-avatar" aria-hidden="true">{post.initials}</span><div><strong>{post.author}</strong><span className="rj-muted">{post.postedAt}</span></div></header>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><Button className="rj-post-more" variant="ghost" size="icon-lg" aria-label="More post actions"><MoreHorizontal /></Button></DropdownMenu.Trigger>
        <DropdownMenu.Content className="rj-add-menu" align="end" sideOffset={4} collisionPadding={12}>
          <DropdownMenu.Item onSelect={onProfile}>Go to profile</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onChat}>Go to chat</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <button className="rj-post-content" onClick={onOpen}>
        <span className="rj-post-excerpt">{post.quote ? <blockquote>{post.content}</blockquote> : <span>{post.content}</span>}{post.attribution && <span className="rj-post-attribution">– {post.attribution}</span>}</span>
        <BookCover src={post.book.cover} title={post.book.title} />
        <ArrowRight className="rj-post-arrow" size={18} aria-hidden="true" />
      </button>
    </div>
    <footer>
      <Button variant="ghost" size="icon-lg" onClick={onShare} aria-label="Share post"><Share2 /></Button>
      <span className="rj-post-reactions">
        <Button variant="ghost" size="lg" onClick={onLike} aria-pressed={Boolean(post.liked)} aria-label={`${post.likes} likes; ${post.liked ? 'unlike' : 'like'} post`}><Heart fill={post.liked ? 'currentColor' : 'none'} />{post.likes}</Button>
        <Button variant="ghost" size="lg" onClick={onComments} aria-label={`${post.comments} comments; open comments`}><MessageCircle />{post.comments}</Button>
      </span>
    </footer>
  </article>;
}
