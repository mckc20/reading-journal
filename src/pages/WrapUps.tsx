import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { AppHeading, HeadingDescription } from '@/components/design';
import { Button } from '@/components/ui/button';
import { fetchWrapUpArchive } from '@/lib/wrapUpClient';
import { monthLabel } from '@/lib/wrapUpArchive';
import { useWrapUpResource } from '@/hooks/useWrapUpResource';
import { defaultWrapUpMonth } from '@/lib/wrapUpPresentation';
import WrapUpMonthNavigation from '@/components/wrap-ups/WrapUpMonthNavigation';
import WrapUpSlide from '@/components/wrap-ups/WrapUpSlide';
import WrapUpDetails from './WrapUpDetails';
import OverflowMenu from '@/components/OverflowMenu';
import { useAuth } from '@/context';

type WrapUpView = 'sliding' | 'list';

function storedView(key: string): WrapUpView | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === 'sliding' || value === 'list' ? value : null;
  } catch { return null; }
}

function WrapUpArchiveList() {
  const { data, error, loading, retry } = useWrapUpResource('archive', fetchWrapUpArchive);
  const years = [...new Set(data?.months.map(month => month.key.slice(0, 4)) ?? [])];
  return (
    <div className="w-full space-y-8">
      {loading && <p role="status" className="text-muted-foreground">Loading your months…</p>}
      {error && <div role="alert" className="space-y-3"><p>{error}</p><Button onClick={retry}>Try again</Button></div>}
      {data && data.months.length === 0 && <div className="rounded-xl bg-muted/30 p-8"><AppHeading level={2} className="text-xl sm:text-2xl">Your story is getting started</AppHeading><p className="mt-3 text-muted-foreground">Wrap-ups will appear here once a month in your recorded reading history is complete.</p><Link className="mt-4 inline-block underline" to="/library">Visit your library</Link></div>}
      {years.map(year => <section key={year} aria-labelledby={`year-${year}`} className="space-y-4">
        <AppHeading level={2} id={`year-${year}`} className="text-xl sm:text-2xl">{year}</AppHeading>
        <ul className="divide-y border-y">
          {data!.months.filter(month => month.key.startsWith(year)).map(month => (
            <li key={month.key}>
              <Link
                to={`/wrap-ups/${month.key}`}
                className="group flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:px-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <h3 className="flex items-center gap-4">
                    <span className="w-12 shrink-0 text-center font-sans text-4xl font-light leading-none tabular-nums text-primary">{month.key.slice(5)}</span>
                    <span className="font-heading text-base underline-offset-4 group-hover:underline group-focus-visible:underline sm:text-lg">{monthLabel(month.key).replace(/ \d{4}$/, '')}</span>
                  </h3>
                  <p className="hidden text-sm text-muted-foreground sm:block">
                    {month.saved ? `Saved wrap-up${month.booksFinished !== undefined ? ` · ${month.booksFinished} ${month.booksFinished === 1 ? 'book' : 'books'} finished` : ''}` : 'Open to create your wrap-up'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>)}
    </div>
  );
}

function SlidingWrapUps() {
  const { monthKey } = useParams();
  const { data, error, loading, retry } = useWrapUpResource('archive', fetchWrapUpArchive);
  if (loading) return <p role="status" className="text-muted-foreground">Loading your months…</p>;
  if (error) return <div role="alert" className="space-y-3"><p>{error}</p><Button onClick={retry}>Try again</Button></div>;
  if (!data) return null;
  if (!monthKey) {
    const initial = defaultWrapUpMonth(data);
    if (initial) return <Navigate to={`/wrap-ups/${initial}`} replace />;
    return <div className="rounded-xl bg-muted/30 p-8"><AppHeading level={2}>Your story is getting started</AppHeading><p className="mt-3 text-muted-foreground">Wrap-ups will appear here once a month in your recorded reading history is complete.</p><Link className="mt-4 inline-block underline" to="/library">Visit your library</Link></div>;
  }
  return (
    <div className="space-y-6">
      {data.months.some(month => month.key === monthKey) && (
        <WrapUpMonthNavigation monthKey={monthKey} months={data.months.map(month => month.key)} />
      )}
      <WrapUpSlide monthKey={monthKey}>
        {key => <WrapUpDetails sliding selectedMonth={key} />}
      </WrapUpSlide>
    </div>
  );
}

function WrapUpViews({ preferenceKey }: { preferenceKey: string }) {
  const { monthKey } = useParams();
  const navigate = useNavigate();
  const lastMonth = useRef(monthKey);
  const [preference, setPreference] = useState(() => storedView(preferenceKey));
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (monthKey) lastMonth.current = monthKey; }, [monthKey]);
  const view = preference ?? (desktop ? 'sliding' : 'list');
  function changeView(next: WrapUpView) {
    setPreference(next);
    try { window.localStorage.setItem(preferenceKey, next); } catch { /* The view still works when browser storage is unavailable. */ }
    if (next === 'list' && monthKey) navigate('/wrap-ups');
    if (next === 'sliding' && !monthKey && lastMonth.current) navigate(`/wrap-ups/${lastMonth.current}`);
  }
  return (
    <div className="w-full space-y-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
            <AppHeading level={1} className="text-2xl sm:text-3xl">Wrap-ups</AppHeading>
          </div>
          <OverflowMenu label="Wrap-up view options">
            {close => <>
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">View</p>
              {(['sliding', 'list'] as const).map(option => (
                <button
                  key={option} type="button" role="menuitemradio" aria-checked={view === option}
                  autoFocus={view === option}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => { changeView(option); close(); }}
                  onKeyDown={event => {
                    const items = Array.from(event.currentTarget.closest('[role="menu"]')!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
                    const index = items.indexOf(event.currentTarget);
                    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
                    if (next !== null) { event.preventDefault(); items[next].focus(); }
                  }}
                >
                  <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{view === option ? '✓' : ''}</span>
                  <span>{option === 'sliding' ? 'Sliding' : 'List'}</span>
                </button>
              ))}
            </>}
          </OverflowMenu>
        </div>
        <HeadingDescription>Your reading, remembered.</HeadingDescription>
      </header>
      {view === 'sliding' ? <SlidingWrapUps /> : monthKey ? <WrapUpDetails /> : <WrapUpArchiveList />}
    </div>
  );
}

export default function WrapUps() {
  const { user } = useAuth();
  const preferenceKey = `reading-journal:wrap-ups-view:${user?.id ?? 'guest'}`;
  return <WrapUpViews key={preferenceKey} preferenceKey={preferenceKey} />;
}
