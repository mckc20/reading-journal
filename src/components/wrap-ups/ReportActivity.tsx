import { useState } from 'react';
import { AppHeading, VerticalBarChart } from '@/components/design';
import { Button } from '@/components/ui/button';
import { buildReportCalendar } from '@/lib/wrapUpPresentation';
import type { MonthlyReport } from '@/lib/wrapUpReports';

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export default function ReportActivity({ activity, monthKey }: {
  activity: MonthlyReport['dailyActivity']; monthKey: string;
}) {
  const [metric, setMetric] = useState<'pagesLogged' | 'minutesLogged'>('pagesLogged');
  const days = activity === undefined ? [] : buildReportCalendar(monthKey, activity);
  const chartData = days.map(day => ({
    key: day.date,
    label: dateLabel(day.date),
    axisLabel: String(Number(day.date.slice(-2))),
    // An unknown date occupies a calendar slot, with no bar and an honest label.
    value: day[metric] ?? 0,
    displayValue: day[metric] === null
      ? metric === 'pagesLogged' ? 'No pages recorded' : 'No reading time recorded'
      : undefined,
  }));
  return (
    <section className="space-y-4 py-4 sm:space-y-5 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <AppHeading level={2} className="min-w-0 text-xl sm:text-2xl">Reading activity</AppHeading>
        {activity !== undefined && (
          <div role="group" aria-label="Activity chart metric" className="inline-flex shrink-0 rounded-md bg-background p-1">
            {(['pagesLogged', 'minutesLogged'] as const).map(key => (
              <Button
                key={key}
                type="button"
                size="xs"
                variant={metric === key ? 'default' : 'ghost'}
                aria-label={key === 'pagesLogged' ? 'Pages logged' : 'Minutes logged'}
                aria-pressed={metric === key}
                onClick={() => setMetric(key)}
              >
                {key === 'pagesLogged' ? 'Pages' : 'Minutes'}<span className="hidden sm:inline"> logged</span>
              </Button>
            ))}
          </div>
        )}
      </div>
      {activity === undefined ? (
        <p className="text-muted-foreground">Daily activity is unavailable for this report.</p>
      ) : (
        <VerticalBarChart
          data={chartData}
          showEmptySeries
          formatValue={value => `${Math.round(value)} ${metric === 'pagesLogged' ? 'pages' : 'min'}`}
        />
      )}
    </section>
  );
}
