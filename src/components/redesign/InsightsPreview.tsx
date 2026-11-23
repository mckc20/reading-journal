import { useChartEntrance } from "@/hooks/useChartEntrance";
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { HomeShell, type HomeDestination, type CreateDestination } from './HomeShell';
import './redesign.css';
import './insights-preview.css';

/** Supplied display summaries only: no production analytics or storage contract. */
export interface InsightsPeriod {
  id: string; label: string; range: string; days: number; logs: number; timedLogs: number;
  averageMinutes: number | null; finished: number;
  buckets: { label: string; days: number; available: number }[];
  previous?: { label: string; days: number; averageMinutes: number | null };
  genres: { name: string; count: number; rated: number; rating: number | null }[];
  returns: string[];
  journeys: string[];
}
export interface InsightsPreviewProps {
  periods: InsightsPeriod[];
  goal: { year: string; finished: number; target: number };
  milestone?: string;
  wrapUp?: { label: string; finished: number; excerpt: string };
  loading?: boolean; error?: string;
  onRetry: () => void; onGoal: () => void; onWrapUps: () => void;
  onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void; onNotifications: () => void;
}
type Detail = 'rhythm' | 'enjoyment' | 'wrap-up';
export function InsightsPreview({ periods, goal, milestone, wrapUp, loading, error, ...actions }: InsightsPreviewProps) {
  const id = useId();
  const motion = useChartEntrance<HTMLElement>();
  const [periodId, setPeriodId] = useState(periods[0]?.id);
  const period = periods.find(item => item.id === periodId) ?? periods[0];
  const [detail, setDetail] = useState<Detail>('rhythm');
  const [open, setOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  function explore(value: Detail, button: HTMLButtonElement) { trigger.current = button; setDetail(value); setOpen(true); }
  const detailTitle = detail === 'rhythm' ? 'Behind your reading rhythm' : detail === 'enjoyment' ? 'Most read, or most enjoyed?' : `${wrapUp?.label} wrap-up`;
  const maxDays = Math.max(1, ...period?.buckets.map(bucket => bucket.available) ?? []);
  return <div className="rj-redesign rj-insights-preview"><HomeShell {...actions} activeDestination="Insights">
    <header className="rj-insights-heading"><div><p className="rj-insights-kicker">A little more about you</p><h1>Insights</h1><p>Find the shape of your reading life.</p></div>
      {period && <label>Explore a period<select value={period.id} onChange={event => setPeriodId(event.target.value)}>{periods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    </header>
    {loading ? <p className="rj-insights-state" role="status">Gathering your reading story…</p> : error ? <EmptyState title="Your insights couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} /> : <>
      {period && <>
        <section className="rj-insights-rhythm" aria-labelledby={`${id}-rhythm`}>
          <div className="rj-insights-section-head"><div><p className="rj-insights-kicker">01 · Your rhythm</p><h2 id={`${id}-rhythm`}>What does my reading rhythm look like?</h2><p>{period.range} · Europe/Vienna</p></div><Button variant="outline" onClick={event => explore('rhythm', event.currentTarget)}>Explore rhythm</Button></div>
          <dl className="rj-insights-summary"><div><dt>Recorded reading days</dt><dd>{period.days}</dd></div><div><dt>Average timed log</dt><dd>{period.averageMinutes === null ? 'Not available' : `${period.averageMinutes} min`}</dd></div><div><dt>Books finished</dt><dd>{period.finished}</dd></div></dl>
          {period.logs === 0 ? <EmptyState title="Your rhythm has room to grow" message="No reading logs in this period. You may still have been reading; finished books and goals can tell another part of the story." /> : <figure {...motion} className="rj-chart-surface rj-insights-chart"><figcaption>Recorded reading days · {period.label}</figcaption><ul>{period.buckets.map(bucket => <li key={bucket.label}><span>{bucket.label}</span><div className="rj-insights-track" aria-hidden="true"><div className="rj-chart-bar rj-chart-bar-horizontal" style={{ width: `${bucket.days / maxDays * 100}%` }} /></div><strong>{bucket.days} / {bucket.available} days</strong></li>)}</ul></figure>}
          <p className="rj-insights-note">A day counts once when a log records pages read or reading minutes. Gaps mean no recorded activity, not necessarily no reading.</p>
          <div className="rj-insights-observations">
            <button onClick={event => explore('rhythm', event.currentTarget)}><span>{period.previous ? `${period.days} recorded days, compared with ${period.previous.days} in ${period.previous.label}.` : `${period.days} recorded days in this period.`}</span><span>See the context ↗</span></button>
            <button onClick={event => explore('rhythm', event.currentTarget)}><span>{period.averageMinutes === null ? 'Reading time is still an open part of the picture.' : `${period.averageMinutes} minutes per timed log. A small space for a story.`}</span><span>See time coverage ↗</span></button>
          </div>
        </section>
        <div className="rj-insights-exploration">
          <section className="rj-insights-panel" aria-labelledby={`${id}-draw`}><p className="rj-insights-kicker">02 · What you return to</p><h2 id={`${id}-draw`}>What draws me in?</h2><p>Genres among books finished in {period.label}.</p>
            {period.genres.length ? <ul className="rj-insights-genres">{period.genres.map(genre => <li key={genre.name}><span>{genre.name}</span><strong>{genre.count} {genre.count === 1 ? 'book' : 'books'}</strong></li>)}</ul> : <p className="rj-insights-quiet">No genre counts yet for this period.</p>}
            {period.returns.map(item => <p className="rj-insights-return" key={item}>{item}</p>)}<p className="rj-insights-note">A multi-genre book appears in each of its genres. Wishlist books are excluded throughout Insights.</p>
          </section>
          <section className="rj-insights-panel rj-insights-enjoyment" aria-labelledby={`${id}-enjoy`}><p className="rj-insights-kicker">03 · A different kind of favorite</p><h2 id={`${id}-enjoy`}>What do I actually enjoy?</h2><p>Does what you rate highly match what you read most?</p>
            {period.genres.some(genre => genre.rated > 0) ? <ul className="rj-insights-ratings">{period.genres.filter(genre => genre.rated > 0).map(genre => <li key={genre.name}><span>{genre.name}</span><strong>{genre.rating?.toFixed(1)} / 5</strong><small>{genre.rated} rated {genre.rated === 1 ? 'book' : 'books'}</small></li>)}</ul> : <p className="rj-insights-quiet">No ratings to explore yet. Ratings are optional.</p>}
            <p className="rj-insights-note">Small samples are a starting point for curiosity, not a lasting preference. Your chosen Profile favorites stay yours.</p><Button variant="outline" onClick={event => explore('enjoyment', event.currentTarget)}>Compare reading and ratings</Button>
          </section>
        </div>
        <section className="rj-insights-panel rj-insights-journey" aria-labelledby={`${id}-journey`}><p className="rj-insights-kicker">04 · At your own pace</p><h2 id={`${id}-journey`}>How do I move through books?</h2><p>Recorded book journeys · {period.label}</p>{period.journeys.length ? <ul>{period.journeys.map(item => <li key={item}>{item}</li>)}</ul> : <p className="rj-insights-quiet">There isn’t enough dated history to describe a journey yet.</p>}<p className="rj-insights-note">Elapsed days include pauses. Pausing or leaving a book unfinished is part of reading, with no score attached. Current status alone cannot reconstruct a past month.</p></section>
      </>}
      <section className="rj-insights-achievements" aria-labelledby={`${id}-achievements`}><p className="rj-insights-kicker">05 · Things to celebrate</p><h2 id={`${id}-achievements`}>What have I accomplished?</h2><div className="rj-insights-exploration">
        <article className="rj-insights-goal"><p>{goal.year} reading goal · Full year</p><h3>{goal.finished} of {goal.target} books</h3><progress aria-label={`${goal.year} book goal`} value={goal.finished} max={goal.target} /><p>{goal.finished >= goal.target ? 'You reached the goal you set. Enjoy this moment.' : 'A direction you chose, at a pace that belongs to you.'}</p><p className="rj-insights-note">Finished books across {goal.year}; independent of the period above.</p><Button variant="outline" onClick={actions.onGoal}>Review goal</Button></article>
        <article className="rj-insights-milestone"><h3>A moment to keep</h3><p>{milestone ?? 'Milestones will have their place here when there is a recorded moment to celebrate.'}</p></article>
      </div></section>
      <section className="rj-insights-wrapup"><div><p className="rj-insights-kicker">Your monthly chapters</p><h2>Return to a wrap-up</h2><p>{wrapUp ? `${wrapUp.label} · ${wrapUp.finished} books finished · Saved snapshot` : 'No saved wrap-up to preview yet.'}</p></div><div>{wrapUp && <Button variant="outline" onClick={event => explore('wrap-up', event.currentTarget)}>Preview saved wrap-up</Button>}<Button variant="ghost" onClick={actions.onWrapUps}>All wrap-ups</Button></div></section>
    </>}
  </HomeShell>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rj-redesign rj-insights-dialog" showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
      <header><DialogTitle ref={title} tabIndex={-1}>{detailTitle}</DialogTitle><DialogDescription>{detail === 'wrap-up' ? 'A saved chapter, separate from the live period above.' : `${period?.label} · The records behind the observation`}</DialogDescription></header>
      <div className="rj-insights-detail" role="region" aria-label="Supporting records" tabIndex={0}>
        {detail === 'rhythm' && period && <><h3>Days with recorded activity</h3><p>{period.days} distinct days · {period.logs} reading logs.</p>{period.buckets.map(bucket => <p key={bucket.label}>{bucket.label}: {bucket.days} of {bucket.available} calendar days.</p>)}<h3>Time coverage</h3><p>{period.timedLogs} of {period.logs} logs include reading minutes. {period.averageMinutes === null ? 'No average is available.' : `Average: ${period.averageMinutes} minutes across timed logs only.`}</p><p>A log is a recorded update, not necessarily a full reading session. Untimed logs are excluded from the average, never filled with zero.</p>{period.previous && <><h3>Comparison: {period.previous.label}</h3><p>{period.previous.days} recorded days. {period.previous.averageMinutes === null ? 'No timed-log average available.' : `${period.previous.averageMinutes} minutes per timed log.`}</p></>}<p>Calendar dates use Europe/Vienna. Only positive page activity or minutes counts toward reading days; duplicate logs on a date count as one day.</p></>}
        {detail === 'enjoyment' && period && <><p>Finished books dated within {period.range}. Ratings are their supplied current ratings, not a historical rating snapshot.</p>{period.genres.length ? <dl className="rj-insights-compare">{period.genres.map(genre => <div key={genre.name}><dt>{genre.name}</dt><dd>{genre.count} finished · {genre.rated} rated · {genre.rating === null ? 'No average' : `${genre.rating.toFixed(1)} / 5 average`}</dd></div>)}</dl> : <p>No finished-book categories in this period.</p>}<p>Each genre includes the same book at most once. A book may belong to several genres; counts do not form parts of a whole. Unrated books do not lower the average. Even a high average from one book offers little evidence of a stable preference.</p><p>These observations never fill or change your Profile favorites.</p></>}
        {detail === 'wrap-up' && wrapUp && <><h3>{wrapUp.label}</h3><p>{wrapUp.finished} books finished</p><p>{wrapUp.excerpt}</p><p>This supplied snapshot stays the same when you change the Insights period. Opening the archive reports a destination; it does not generate or replace a report.</p></>}
      </div><footer><DialogClose asChild><Button variant="outline">Back to Insights</Button></DialogClose></footer>
    </DialogContent></Dialog>
  </div>;
}
