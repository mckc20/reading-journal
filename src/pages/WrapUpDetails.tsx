import { useCallback, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, LoaderCircle } from 'lucide-react';
import { AppHeading } from '@/components/design';
import { Button } from '@/components/ui/button';
import ReportBooks from '@/components/wrap-ups/ReportBooks';
import ReportActivity from '@/components/wrap-ups/ReportActivity';
import ReportOtherBooks from '@/components/wrap-ups/ReportOtherBooks';
import BookRating from '@/components/reading-journal/BookRating';
import { useWrapUpResource } from '@/hooks/useWrapUpResource';
import { openWrapUp } from '@/lib/wrapUpClient';
import { monthLabel } from '@/lib/wrapUpArchive';
import type { ReportTotals } from '@/lib/wrapUpReports';

function StorySection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 py-4 sm:space-y-5 sm:py-6">
      <AppHeading level={2} className="text-xl sm:text-2xl">{title}</AppHeading>
      {children}
    </section>
  );
}

const metrics: { key: keyof ReportTotals; label: string; intro: string; unit: string; singularUnit: string }[] = [
  { key: 'booksFinished', label: 'Books finished', intro: 'You finished', unit: 'books', singularUnit: 'book' },
  { key: 'pagesLogged', label: 'Pages logged', intro: 'You logged', unit: 'pages', singularUnit: 'page' },
  { key: 'minutesLogged', label: 'Minutes logged', intro: 'You logged', unit: 'minutes', singularUnit: 'minute' },
  { key: 'readingDays', label: 'Days with logged activity', intro: 'You logged activity on', unit: 'days', singularUnit: 'day' },
];
const number = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en');
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});

export default function WrapUpDetails({ sliding = false, selectedMonth }: {
  sliding?: boolean;
  selectedMonth?: string;
}) {
  const params = useParams();
  const monthKey = selectedMonth ?? params.monthKey ?? '';
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)
    && monthKey >= '0001-02' && monthKey <= '9998-12';
  const load = useCallback((signal: AbortSignal) => valid
    ? openWrapUp(monthKey, signal)
    : Promise.reject(new Error('Choose a valid month from your archive.')), [monthKey, valid]);
  const { data, error, loading, retry } = useWrapUpResource(monthKey, load);
  const report = data?.snapshot;

  return (
    <div className="w-full space-y-6">
      {!sliding && <Link
        to="/wrap-ups"
        className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />All wrap-ups
      </Link>}
      {loading && (
        <div role="status" className="flex min-h-64 items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">Loading your wrap-up…</span>
        </div>
      )}
      {error && (
        <div role="alert" className="space-y-3">
          <AppHeading level={2} className="text-2xl sm:text-3xl">Wrap-up unavailable</AppHeading>
          <p>{error}</p>
          {valid && <Button onClick={retry}>Try again</Button>}
        </div>
      )}
      {report && data && (
        <>
          {!sliding && <AppHeading level={2} className="text-3xl sm:text-5xl text-center">
            {monthLabel(report.period.key)}
          </AppHeading>}
          <header className="space-y-6 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-background p-6 sm:p-10">
            <dl className="grid grid-cols-2 gap-6">
              {metrics.map(metric => {
                const value = report.totals[metric.key];
                return (
                  <div key={metric.key} className="min-w-0">
                    <dt className="text-sm text-muted-foreground">
                      {value === null ? metric.label : metric.intro}
                    </dt>
                    <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className={`font-heading ${value === null ? 'text-xl' : 'text-4xl sm:text-5xl'}`}>
                        {number(value)}
                      </span>
                      {value !== null && (
                        <span className="text-base">
                          {value === 1 ? metric.singularUnit : metric.unit}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </header>

          <StorySection title="Books you read">
            {report.finishedBooks.length ? <ReportBooks books={report.finishedBooks} activity={report.finishedBookActivity} /> : (
              <p className="text-muted-foreground">
                No books have a recorded finish date in this month. Every bit of reading can still be part of your story.
              </p>
            )}
          </StorySection>

          <StorySection title="Your personal highlights">
            {Object.keys(report.highlights).length > 0 ? (
              <ul className="space-y-4">
                {report.highlights.highestRatedBook && (
                  <li className="rounded-xl bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">Highest rated book</p>
                    <p className="mt-1 flex items-center gap-2 font-heading text-lg sm:text-xl">
                      {report.highlights.highestRatedBook.title}
                      {report.highlights.highestRatedBook.is_favorite && <Heart className="h-4 w-4 shrink-0 fill-favorite text-favorite" aria-label="Favorite" />}
                    </p>
                    <BookRating rating={report.highlights.highestRatedBook.rating} />
                  </li>
                )}
                {report.highlights.longestSession && (
                  <li className="rounded-xl bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Longest recorded session</p>
                    <p className="mt-1 font-heading text-lg sm:text-xl">{report.highlights.longestSession.minutes} minutes</p>
                  </li>
                )}
                {report.highlights.mostPagesDay && (
                  <li className="rounded-xl bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">Most pages logged in a day</p>
                    <p className="mt-1 font-heading text-lg sm:text-xl">
                      {report.highlights.mostPagesDay.pages} pages · {dateLabel(report.highlights.mostPagesDay.date)}
                    </p>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground">There isn’t enough recorded information for personal highlights this month.</p>
            )}
          </StorySection>

          <ReportActivity key={report.period.key} activity={report.dailyActivity} monthKey={report.period.key} />

          <StorySection title={<>Compared with <Link
            to={`/wrap-ups/${report.previousMonth.period.key}`}
            className="rounded-sm underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >{monthLabel(report.previousMonth.period.key)}</Link></>}>
            <dl className="grid grid-cols-2 gap-6">
              {metrics.map(metric => {
                const difference = report.previousMonth.differences[metric.key];
                const previous = report.previousMonth.totals[metric.key];
                return (
                  <div key={metric.key} className="min-w-0">
                    <dt className="text-sm text-muted-foreground">
                      {difference === null ? metric.label : metric.intro}
                    </dt>
                    <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className={`font-heading ${difference === null ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
                        {difference === null ? 'Comparison unavailable' : `${difference > 0 ? '+' : ''}${number(difference)}`}
                      </span>
                      {difference !== null && (
                        <span className="text-base">
                          {Math.abs(difference) === 1 ? metric.singularUnit : metric.unit}
                        </span>
                      )}
                      <span className="mt-1 basis-full text-sm text-muted-foreground">
                        Previous: {number(previous)}
                        {previous !== null && ` ${previous === 1 ? metric.singularUnit : metric.unit}`}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </StorySection>

          {(report.otherBookActivity ?? report.activeBooks).length > 0 && (
            <StorySection title="Other books you spent time with">
              <ReportOtherBooks report={report} />
            </StorySection>
          )}
        </>
      )}
    </div>
  );
}
