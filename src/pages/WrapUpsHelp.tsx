import { Link } from 'react-router-dom';
import { ArrowLeft, CircleHelp } from 'lucide-react';
import { AppHeading, HeadingDescription } from '@/components/design';

export default function WrapUpsHelp() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <Link to="/help" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />All help topics
      </Link>
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <CircleHelp className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <AppHeading level={1} id="wrap-ups">Wrap-ups</AppHeading>
        </div>
        <HeadingDescription>A guide to your monthly reading story.</HeadingDescription>
      </header>

      <section aria-labelledby="wrap-ups" className="space-y-6">
        <div className="space-y-2">
          <p className="leading-relaxed">
            Your monthly wrap-ups bring together the books, journal entries, and reading activity
            you recorded. <Link to="/wrap-ups" className="text-primary underline underline-offset-4">Open your wrap-ups</Link> to revisit a month.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Opening and saving a month</AppHeading>
          <p className="leading-relaxed">
            Wrap-ups cover completed calendar months in your recorded reading history. The current
            month becomes available after it ends. Opening an unsaved month creates and saves its
            wrap-up; opening a saved month shows the same saved version again.
          </p>
          <p className="leading-relaxed">
            The three-dot menu beside “Wrap-ups” lets you choose Sliding view or List view on any
            screen size. Your choice is remembered in this browser for your account. Before you
            choose, desktop opens Sliding view and mobile opens List view.
          </p>
          <p className="leading-relaxed">
            Sliding view opens the previous completed month, or the newest available month if that
            month is not in your history. Use the arrows beside the month heading to move between
            months, or select the heading to choose a month and year separately. In List view,
            choose a month from the list and use “All wrap-ups” to return to it. You can switch views
            from an open wrap-up too.
          </p>
          <p className="leading-relaxed">
            A wrap-up uses the records available when it is created, including the book details,
            ratings, favorites, journal entries, and comparison totals available then. Later edits
            won’t update it, and it cannot reconstruct information you changed before it was saved.
            A book or journal entry deleted later may no longer open from its link.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">What the main stats count</AppHeading>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed">
            <li><strong>Books finished:</strong> books with a recorded finish date in that month, even if they have no reading logs.</li>
            <li><strong>Pages logged:</strong> increases in recorded page progress. Correcting a page number downwards does not subtract pages or count the same progress again. A first log counts progress from page zero.</li>
            <li><strong>Minutes logged:</strong> the reading time you entered in logs. Missing times are left out, so a total may include only some of your logs.</li>
            <li><strong>Days with logged activity:</strong> distinct days when you logged additional pages or a reading time above zero. Adding a journal entry alone does not count as a reading day.</li>
          </ul>
          <p className="leading-relaxed">
            These totals describe what you recorded, rather than all the reading you may have done.
            “Unavailable” means the needed logs or recorded times are missing; it does not mean you
            did no reading. Records with invalid dates are excluded from the calculations that need those dates.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Books you read</AppHeading>
          <p className="leading-relaxed">
            This section shows books with a finish date in the month. One book appears with its
            details beside the cover; a few books use a grid. Larger collections use a horizontal
            shelf you can swipe, scroll, or navigate with the arrows. Select a book to open it.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Your personal highlights</AppHeading>
          <p className="leading-relaxed">
            “Highest rated book” is selected from the books finished that month. Favorites rank
            ahead of non-favorites, even a non-favorite with five stars; ratings decide between
            favorites. An unrated favorite can also be selected. “Longest recorded session” is your
            longest timed reading log, and “Most pages logged in a day” adds up recorded page
            progress for each day. A highlight appears only when enough information was recorded.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Reading activity</AppHeading>
          <p className="leading-relaxed">
            Switch between pages and minutes to see your daily logged activity. The chart includes
            every day in the month, including days without logs. An empty day does not mean you did
            not read. Missing reading time is not treated as zero minutes. Older saved wrap-ups may
            not contain daily chart data.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Compared with the previous month</AppHeading>
          <p className="leading-relaxed">
            Each number is the difference from the previous month: a plus means more, a minus means
            less, and zero means the same total. The previous total appears underneath. Comparisons
            are unavailable when either month lacks the needed information. Select the previous
            month’s name to open its wrap-up. Comparison totals reflect the records available when
            this wrap-up was saved, so a separately saved older wrap-up can show different totals.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Other books you spent time with</AppHeading>
          <p className="leading-relaxed">
            These books have additional pages, reading time above zero, or journal entries dated in
            the month, and are not already listed under “Books you read”. A book can appear just
            because you added a note, review, or quote. Its activity text explains why it is included
            and, where recorded, whether it was started that month and remained unfinished at month-end.
          </p>
          <p className="leading-relaxed">
            On desktop, one journal entry is shown: a saved entry is preferred, otherwise the latest
            dated entry is selected. Long entries show a shortened preview with a “Read full entry”
            link. Mobile shows the entry count and a link to the book’s journal
            instead. Older saved wrap-ups may not include per-book totals or journal entries.
          </p>
        </div>

        <div className="space-y-2">
          <AppHeading level={2} className="text-xl sm:text-2xl">Dates and timezones</AppHeading>
          <p className="leading-relaxed">
            Reading logs are grouped into days and calendar months using the profile timezone
            available when the wrap-up is created. If that timezone is unavailable or invalid, UTC
            is used. Book start and finish dates and journal entry dates use their recorded calendar
            dates. A saved wrap-up keeps its original timezone and records.
          </p>
        </div>
      </section>
    </div>
  );
}
