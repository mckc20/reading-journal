import { useId, useState, type ReactNode } from 'react';
import { MoreReadingActions } from './MoreReadingActions';
import { Button } from '@/components/ui/button';
import { QuickBookCarousel } from './QuickBookCarousel';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { BookShelf, CommunityPost, GoalCard, ReadingBookCard, type HomeBook, type HomePost, type ReadingGoal } from './HomeCards';
import { HomeShell, type CreateDestination, type HomeDestination } from './HomeShell';
import './redesign.css';

function HomeSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="rj-home-section" aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

export function QuickProgress({ books, selectedId, onSelect, onRead, onChangeDate, onSession, onEditLogs }: {
  books: HomeBook[]; selectedId: string; onSelect: (id: string) => void;
  onRead: (book: HomeBook, trigger: HTMLButtonElement) => void;
  onChangeDate?: (book: HomeBook, trigger: HTMLButtonElement) => void;
  onSession?: (book: HomeBook, trigger: HTMLButtonElement) => void;
  onEditLogs?: (book: HomeBook) => void;
}) {
  const selected = books.find(book => book.id === selectedId) ?? books[0];
  return <div className="rj-quick-container"><section className="rj-quick-progress" aria-label="Quick reading progress">
    <div className="rj-quick-copy"><h1 className="rj-quick-title">How’s your<br />reading going?</h1>
      <div className="rj-quick-actions"><Button onClick={event => selected && onRead(selected, event.currentTarget)} disabled={!selected}><span className="rj-read-label">Update Progress</span></Button>
        {(onChangeDate || onSession || onEditLogs) && (
          <MoreReadingActions
            disabled={!selected}
            onChangeDate={onChangeDate && (trigger => selected && onChangeDate(selected, trigger))}
            onSession={onSession && (trigger => selected && onSession(selected, trigger))}
            onEditLogs={onEditLogs && (() => selected && onEditLogs(selected))}
          />
        )}
      </div>
    </div>
    <QuickBookCarousel books={books} selectedId={selected?.id} onSelect={onSelect} onActivate={(id, trigger) => { const book = books.find(item => item.id === id); if (book) onRead(book, trigger); }} />
  </section></div>;
}

export interface RedesignHomeProps {
  reading: HomeBook[]; recommendations: HomeBook[]; goal?: ReadingGoal; posts: HomePost[];
  upNext?: HomeBook[];
  loading?: boolean; error?: string; onRetry: () => void;
  onRead: (book: HomeBook) => void; onChangeDate: (book: HomeBook) => void; onSession: (book: HomeBook) => void; onEditLogs: (book: HomeBook) => void;
  onOpenBook: (book: HomeBook) => void; onGoal: () => void;
  onNavigate: (destination: HomeDestination) => void; onCreate: (destination: CreateDestination) => void;
  onNotifications: () => void;
  onPostAction: (post: HomePost, action: 'like' | 'comments' | 'share' | 'open' | 'profile' | 'chat') => void;
}

function GoalSections({ goal, upNext = [], onGoal, onOpenBook }: Pick<RedesignHomeProps, 'goal' | 'upNext' | 'onGoal' | 'onOpenBook'>) {
  return <>
    <HomeSection title="Your Goals">{goal ? <GoalCard goal={goal} onOpen={onGoal} /> : <Button variant="outline" onClick={onGoal}>Set a reading goal</Button>}</HomeSection>
    {upNext.length > 0 && <HomeSection title="Up Next"><BookShelf books={upNext} onOpen={onOpenBook} showStatus={false} /></HomeSection>}
  </>;
}

/** Home composition for review. All account behavior is supplied by its caller. */
export function RedesignHome(props: RedesignHomeProps) {
  const [selectedId, setSelectedId] = useState(props.reading[0]?.id ?? '');
  return <div className="rj-redesign"><HomeShell {...props}>
    {props.loading ? <div className="rj-home-loading" role="status" aria-live="polite">Loading your reading space…<div /><div /><div /></div> : props.error ? <EmptyState title="Your reading space couldn’t load" message={props.error} action={<Button onClick={props.onRetry}>Try again</Button>} /> : <>
      <QuickProgress books={props.reading} selectedId={selectedId} onSelect={setSelectedId} onRead={props.onRead} onChangeDate={props.onChangeDate} onSession={props.onSession} onEditLogs={props.onEditLogs} />
      <div className="rj-home-grid">
        <div className="rj-home-main">
          <HomeSection title="Currently Reading">
            {props.reading.length === 1 ? <ReadingBookCard book={props.reading[0]} onOpen={props.onOpenBook} /> : props.reading.length > 1 ? <BookShelf books={props.reading} onOpen={props.onOpenBook} /> : <EmptyState compact title="A new chapter awaits" message="Choose a book from your library to start reading." action={<Button variant="outline" onClick={() => props.onNavigate('Library')}>Browse library</Button>} />}
          </HomeSection>
          <div className="rj-mobile-goal"><GoalSections {...props} /></div>
          <HomeSection title="Recommended for you">{props.recommendations.length ? <BookShelf books={props.recommendations} onOpen={props.onOpenBook} /> : <p className="rj-muted">No recommendations yet. Your next favorite is waiting in your library.</p>}</HomeSection>
          <HomeSection title="From others">{props.posts.length ? <div className="rj-posts">{props.posts.map(post => <CommunityPost key={post.id} post={post} onLike={() => props.onPostAction(post, 'like')} onComments={() => props.onPostAction(post, 'comments')} onShare={() => props.onPostAction(post, 'share')} onOpen={() => props.onPostAction(post, 'open')} onProfile={() => props.onPostAction(post, 'profile')} onChat={() => props.onPostAction(post, 'chat')} />)}</div> : <p className="rj-muted">Posts from your reading friends will appear here.</p>}</HomeSection>
        </div>
        <aside className="rj-desktop-goal" aria-label="Reading goals and up next"><GoalSections {...props} /><p className="rj-aside-note">Your place, for your books.<br />One chapter at a time.</p></aside>
      </div>
    </>}
  </HomeShell></div>;
}
