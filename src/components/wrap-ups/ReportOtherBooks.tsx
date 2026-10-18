import { Link } from 'react-router-dom';
import ReportBookFeature from './ReportBookFeature';
import ReportJournalEntryPreview from './ReportJournalEntryPreview';
import { bookMonthContext, featuredJournalEntry } from '@/lib/wrapUpPresentation';
import type { MonthlyReport } from '@/lib/wrapUpReports';

export default function ReportOtherBooks({ report }: { report: MonthlyReport }) {
  const items = report.otherBookActivity ?? report.activeBooks.map(book => ({
    book, logCount: null, pagesLogged: null, minutesLogged: null, journalEntries: [],
  }));
  return (
    <div className="divide-y">
      {items.map(item => {
        const entry = featuredJournalEntry(item.journalEntries);
        const journalOnly = item.journalEntries.length > 0
          && !(item.pagesLogged !== null && item.pagesLogged > 0)
          && !(item.minutesLogged !== null && item.minutesLogged > 0);
        return (
          <ReportBookFeature key={item.book.id} book={item.book}>
            <div className="min-w-0 space-y-4">
              <p className="text-sm font-medium">
                {journalOnly
                  ? item.journalEntries.length === 1 ? 'Added a journal entry' : `Added ${item.journalEntries.length} journal entries`
                  : bookMonthContext(item.book, report.period.key)}
              </p>
              {item.logCount === null ? (
                <p className="text-sm">
                  You recorded page progress or reading time for this book during the month.
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  {item.logCount > 0 ? (
                    <p>
                      You logged {item.pagesLogged?.toLocaleString('en')} pages
                      {item.minutesLogged !== null ? ` and ${item.minutesLogged.toLocaleString('en')} minutes` : ''}
                      {' '}across {item.logCount} reading {item.logCount === 1 ? 'log' : 'logs'} this month.
                      {item.minutesLogged === null && ' Reading time wasn’t recorded.'}
                    </p>
                  ) : <p>No reading logs were recorded for this book this month.</p>}
                  {item.journalEntries.length > 0 && (
                    <p>
                      You have {item.journalEntries.length} journal {item.journalEntries.length === 1 ? 'entry' : 'entries'} dated this month.
                      {' '}
                      <Link
                        to={item.journalEntries.length === 1 && entry
                          ? `/books/${item.book.id}/journal?entry=${encodeURIComponent(entry.id)}`
                          : `/books/${item.book.id}/journal`}
                        className="ml-2 inline-block rounded-sm text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.journalEntries.length === 1 ? 'Show entry' : 'Show all entries'}
                      </Link>
                    </p>
                  )}
                </div>
              )}
              {entry && <div className="hidden sm:block"><ReportJournalEntryPreview entry={entry} /></div>}
            </div>
          </ReportBookFeature>
        );
      })}
    </div>
  );
}
