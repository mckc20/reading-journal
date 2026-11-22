import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { InsightsPreview, type InsightsPreviewProps } from '@/components/redesign/InsightsPreview';
import { Button } from '@/components/ui/button';
import { emptyPeriods, insightsGoal, insightsPeriods, insightsWrapUp, sparsePeriods } from './insightsFixtures';

function InsightsReview(args: InsightsPreviewProps) {
  const [error, setError] = useState(args.error);
  const [notice, setNotice] = useState('');
  return <><InsightsPreview {...args} error={error} onRetry={() => setError(undefined)} onGoal={() => setNotice('Goal review requested — editing is outside this preview.')} onWrapUps={() => setNotice('Wrap-up archive requested — preview only')}
    onNavigate={destination => setNotice(`${destination} — preview only`)} onCreate={destination => setNotice(`Create ${destination} — preview only`)} onNotifications={() => setNotice('Notifications — preview only')} />
    {notice && <div className="rj-redesign" role="status" style={{ position: 'fixed', bottom: 180, left: 16, right: 16, zIndex: 30, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>{notice}<Button variant="ghost" onClick={() => setNotice('')}>Dismiss</Button></div>}</>;
}
const noop = () => {};
const meta = {
  title: 'Redesign/Insights', component: InsightsPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Question-led exploration using fictional precomputed month/year summaries. Rhythm leads; reading, ratings and neutral book journeys follow. Yearly goals and achievements remain visible independently of the selected period. All observations open supporting values. Partial time and small rating samples are explicit. Saved wrap-up preview never recalculates. Goals/archive/navigation use intent callbacks. No production analytics, auth, APIs, account data or persistence. Custom dates, goal forms, series completion and concurrent-reading calculations are deferred. Profile favorites are never inferred or changed.' } } },
  args: { periods: insightsPeriods, goal: insightsGoal, wrapUp: insightsWrapUp, milestone: 'Three volumes, one complete story. You finished The Tideglass Letters in August. All three published volumes are recorded as finished.', onGoal: noop, onWrapUps: noop, onRetry: noop, onNavigate: noop, onCreate: noop, onNotifications: noop },
  render: args => <InsightsReview key={JSON.stringify([args.periods, args.error, args.loading])} {...args} />,
} satisfies Meta<typeof InsightsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
const bodyFor = (element: HTMLElement) => within(element.ownerDocument.body);
const close = async (element: HTMLElement) => {
  await userEvent.click(within(await bodyFor(element).findByRole('dialog')).getByRole('button', { name: 'Back to Insights' }));
  await waitFor(() => expect(bodyFor(element).queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
};
export const Overview: Story = {};
export const Sparse: Story = { args: { periods: sparsePeriods, milestone: undefined } };
export const NoData: Story = { args: { periods: emptyPeriods, goal: { year: '2026', finished: 0, target: 12 }, milestone: undefined, wrapUp: undefined } };
export const MissingTime: Story = { args: { periods: insightsPeriods.map(period => ({ ...period, timedLogs: 0, averageMinutes: null })) } };
export const NoRatings: Story = { args: { periods: insightsPeriods.map(period => ({ ...period, genres: period.genres.map(genre => ({ ...genre, rated: 0, rating: null })) })) } };
export const PausedAndDNF: Story = { args: { periods: [insightsPeriods[0]], milestone: undefined } };
export const AchievedGoal: Story = { args: { goal: { year: '2026', finished: 30, target: 30 } } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please try again to explore your reading records.' } };
export const PeriodAndEvidence: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('18 recorded days, compared with 12 in September 2026.')).toBeVisible();
    const rhythm = canvas.getByRole('button', { name: 'Explore rhythm' });
    rhythm.focus(); await userEvent.keyboard('{Enter}');
    let dialog = within(await bodyFor(canvasElement).findByRole('dialog'));
    await expect(dialog.getByRole('heading', { name: 'Behind your reading rhythm' })).toHaveFocus();
    await expect(dialog.getByRole('region')).toHaveTextContent('20 of 24 logs');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(rhythm).toHaveFocus());
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Explore a period' }), 'year');
    await expect(canvas.getByText('136 recorded days in this period.')).toBeVisible();
    await expect(canvas.queryByText(/18 recorded days, compared/)).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: '24 of 30 books' })).toBeVisible();
    await userEvent.click(rhythm);
    dialog = within(await bodyFor(canvasElement).findByRole('dialog'));
    await expect(dialog.getByRole('region')).toHaveTextContent('144 of 180 logs');
    await close(canvasElement); await waitFor(() => expect(rhythm).toHaveFocus());
    await userEvent.selectOptions(canvas.getByRole('combobox'), 'month');
  },
};
export const CompareAndReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Compare reading and ratings' });
    await userEvent.click(trigger);
    const dialog = within(await bodyFor(canvasElement).findByRole('dialog'));
    await expect(dialog.getByRole('region')).toHaveTextContent('3 finished · 3 rated · 3.7 / 5 average');
    await expect(dialog.getByRole('region')).toHaveTextContent('2 finished · 2 rated · 4.5 / 5 average');
    await expect(dialog.getByRole('region')).toHaveTextContent('never fill or change your Profile favorites');
    await close(canvasElement); await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const MissingEvidence: Story = {
  args: NoData.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Your rhythm has room to grow')).toBeVisible();
    await expect(canvas.getByText('No ratings to explore yet. Ratings are optional.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Explore rhythm' }));
    await expect(within(await bodyFor(canvasElement).findByRole('dialog')).getByRole('region')).toHaveTextContent('0 of 0 logs include reading minutes. No average is available.');
    await close(canvasElement);
  },
};
export const SnapshotAndIntents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole('combobox'), 'year');
    const trigger = canvas.getByRole('button', { name: 'Preview saved wrap-up' });
    await userEvent.click(trigger);
    await expect(within(await bodyFor(canvasElement).findByRole('dialog')).getByRole('heading', { name: 'September 2026 wrap-up' })).toBeVisible();
    await expect(within(await bodyFor(canvasElement).findByRole('dialog')).getByRole('region')).toHaveTextContent('3 books finished');
    await close(canvasElement); await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(canvas.getByRole('button', { name: 'Review goal' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('editing is outside this preview');
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await userEvent.click(canvas.getByRole('button', { name: 'All wrap-ups' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Wrap-up archive requested');
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
  },
};
export const ObservationDetails: Story = {
  args: MissingTime.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ['See the context', 'See time coverage']) {
      const trigger = canvas.getByRole('button', { name: new RegExp(label) });
      await userEvent.click(trigger);
      await expect(within(await bodyFor(canvasElement).findByRole('dialog')).getByRole('region')).toHaveTextContent('0 of 24 logs include reading minutes');
      await close(canvasElement); await waitFor(() => expect(trigger).toHaveFocus());
    }
  },
};
export const Retry: Story = {
  args: LoadError.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(canvas.getByRole('heading', { name: 'What does my reading rhythm look like?' })).toBeVisible();
  },
};
