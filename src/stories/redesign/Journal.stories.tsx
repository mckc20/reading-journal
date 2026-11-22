import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { JournalPreview, type JournalPreviewProps } from '@/components/redesign/JournalPreview';
import { journalEntries, longJournalEntry } from './journalFixtures';

function JournalReview(args: JournalPreviewProps) {
  const [error, setError] = useState(args.error);
  const [notice, setNotice] = useState('');
  return <><JournalPreview {...args} error={error} onRetry={() => setError(undefined)} onCreate={destination => setNotice(destination === 'entry' ? 'Write an entry requested — editor is outside this preview.' : `Create ${destination} — preview only`)} onNavigate={destination => setNotice(`${destination} — preview only`)} onNotifications={() => setNotice('Notifications — preview only')} />
    {notice && <div className="rj-redesign" role="status" style={{ position: 'fixed', bottom: 180, left: 16, right: 16, zIndex: 30, padding: 16, border: '1px solid var(--border)', borderRadius: 16 }}>{notice}<button style={{ marginLeft: 12, minHeight: 44 }} onClick={() => setNotice('')}>Dismiss</button></div>}</>;
}
const noop = () => {};
const meta = {
  title: 'Redesign/Journal', component: JournalPreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Writing-first collection, using fictional plain-text entries. Newest first; six-line excerpts open a full reader. Search matches entry titles, writing, attribution and related names; type and relationship filters combine. All controls remain visible on phone. Independent entries are a preview proposal, not an existing persistence contract. Write an entry reports intent only. No editor, network, sharing, auth or storage.' } } },
  args: { entries: journalEntries, onRetry: noop, onCreate: noop, onNavigate: noop, onNotifications: noop },
  render: args => <JournalReview key={JSON.stringify([args.entries, args.error, args.loading, args.initialQuery])} {...args} />,
} satisfies Meta<typeof JournalPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Populated: Story = {};
export const IndependentEntry: Story = { args: { entries: [journalEntries[1]] } };
export const MissingCover: Story = { args: { entries: [journalEntries[0]] } };
export const Empty: Story = { args: { entries: [] } };
export const Loading: Story = { args: { loading: true } };
export const LoadError: Story = { args: { error: 'Please try again. Your writing has not been changed.' } };
export const NoResults: Story = { args: { initialQuery: 'unfindable phrase' } };
export const LongWriting: Story = { args: { entries: [longJournalEntry, journalEntries[1]] } };
export const ReadAndReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Some days I read to find something new/)).toBeVisible();
    const trigger = canvas.getByRole('button', { name: 'Read entry: A slower kind of morning' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog');
    await expect(within(dialog).getByRole('heading')).toHaveFocus();
    await expect(within(dialog).getByRole('region', { name: 'Full entry' })).toHaveTextContent('without turning them into another task');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await userEvent.click(within(await body.findByRole('dialog')).getByRole('button', { name: 'Back to journal' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const SearchAndFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = () => canvas.getByRole('list', { name: 'Journal entries' });
    await expect(list().children).toHaveLength(6);
    await userEvent.type(canvas.getByRole('searchbox'), 'atlas');
    await expect(list().children).toHaveLength(2);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Entry type' }), 'quote');
    await expect(list().children).toHaveLength(1);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Related to' }), 'independent');
    await expect(canvas.getByText('No entries found')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show all entries' }));
    await expect(list().children).toHaveLength(6);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Related to' }), 'Series:tide');
    await expect(list().children).toHaveLength(1);
    await expect(within(list()).getByRole('heading', { name: 'Returning to the coast' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset filters' }));
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Related to' }), 'independent');
    await expect(list().children).toHaveLength(1);
    await userEvent.type(canvas.getByRole('searchbox'), 'feeling');
    await expect(list().children).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset filters' }));
  },
};
export const Retry: Story = {
  args: LoadError.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(canvas.getByRole('list', { name: 'Journal entries' }).children).toHaveLength(6);
  },
};
export const WriteIntent: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Write your first entry' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('editor is outside this preview');
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
  },
};
export const ReadLongWriting: Story = {
  args: LongWriting.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: `Read entry: ${longJournalEntry.title}` });
    await userEvent.click(trigger);
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole('dialog'));
    const reader = dialog.getByRole('region', { name: 'Full entry' });
    await expect(reader).toHaveTextContent('The last line belongs here too.');
    reader.focus();
    await userEvent.keyboard('{End}');
    await expect(dialog.getByRole('button', { name: 'Back to journal' })).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Back to journal' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
