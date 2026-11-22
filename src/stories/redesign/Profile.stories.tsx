import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { favoriteKinds, ProfilePreview, type ProfilePreviewProps } from '@/components/redesign/ProfilePreview';
import { longReaderProfile, newReaderProfile, profileCatalog, readerProfile } from './profileFixtures';

type ReviewProps = ProfilePreviewProps & { saveBehavior?: 'success' | 'fail-once' | 'slow'; activityControl?: boolean };
function ProfileReview({ saveBehavior = 'success', activityControl, ...args }: ReviewProps) {
  const attempts = useRef(0);
  const [notice, setNotice] = useState('');
  const [activityChanged, setActivityChanged] = useState(false);
  return <><ProfilePreview {...args} currentlyReading={activityChanged ? profileCatalog.book[2] : args.currentlyReading}
    onSave={async () => {
      attempts.current += 1;
      if (saveBehavior === 'slow') await new Promise(resolve => setTimeout(resolve, 1800));
      if (saveBehavior === 'fail-once' && attempts.current === 1) throw new Error('Simulated failure');
      setNotice(`Local save completed · ${attempts.current} request${attempts.current === 1 ? '' : 's'}`);
    }}
    onNavigate={destination => setNotice(`${destination} — preview only`)} onCreate={destination => setNotice(`Create ${destination} — preview only`)} onNotifications={() => setNotice('Notifications — preview only')}
    onSettings={() => setNotice('Settings requested — preview only')} onMessage={() => setNotice('Conversation requested — preview only')} onOpenBook={() => setNotice('Book details requested — preview only')} />
    {activityControl && <aside className="rj-redesign" style={{ padding: 24, paddingBottom: 150 }} aria-label="Workshop activity simulation"><p>Workshop control: finish a book, change its rating and mark another library favorite.</p><dl><dt>The Last Lantern status</dt><dd>{activityChanged ? 'Finished' : 'Reading'}</dd><dt>The Last Lantern rating</dt><dd>{activityChanged ? '5 stars' : 'Unrated'}</dd><dt>A Garden After Rain library favorite</dt><dd>{activityChanged ? 'Yes' : 'No'}</dd></dl><Button onClick={() => { setActivityChanged(true); setNotice('Sample activity changed. Chosen profile favorites stayed the same.'); }}>Simulate reading activity</Button></aside>}
    {notice && <div className="rj-redesign" role="status" style={{ position: 'fixed', bottom: 180, left: 16, right: 16, zIndex: 30, padding: 16, border: '1px solid var(--border)', borderRadius: 16 }}>{notice}<Button variant="ghost" onClick={() => setNotice('')}>Dismiss</Button></div>}
  </>;
}
const noop = () => {};
const meta = {
  title: 'Redesign/Profile', component: ProfilePreview,
  parameters: { layout: 'fullscreen', docs: { description: { component: 'Fictional reader identity and manually chosen favorites. Owner, visitor and explicit first-login stories; no auth, real detection, account data, APIs or persistence. One optional choice per category, Skip, native catalog selectors (keyboard type-ahead), owner-only reading/milestone and public-preview content are reversible proposals. Choices are available without library books. Edit keeps a draft; Save updates local state only after callback success, Cancel/Escape discards, failure retains edits, pending blocks edits/dismissal. Reload resets everything. Public preview demonstrates composition, not production privacy. No automatic favorite calculation or replacement; no free-text catalog creation, avatar upload or goal management.' } } },
  args: { profile: readerProfile, catalog: profileCatalog, currentlyReading: profileCatalog.book[1], achievement: 'You finished The Tideglass Letters — a story you stayed with.', onSave: async () => {}, onSettings: noop, onMessage: noop, onOpenBook: noop, onNavigate: noop, onCreate: noop, onNotifications: noop },
  render: args => <ProfileReview key={JSON.stringify([args.profile, args.mode, args.firstLogin])} {...args} />,
} satisfies Meta<typeof ProfilePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
const dialogFor = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body).findByRole('dialog');
const waitForClose = (canvasElement: HTMLElement) => waitFor(() => {
  expect(within(canvasElement.ownerDocument.body).queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe('none');
});
export const Owner: Story = {};
export const Visitor: Story = { args: { mode: 'visitor' } };
export const FirstLogin: Story = { args: { profile: newReaderProfile, firstLogin: true, currentlyReading: undefined, achievement: undefined } };
export const EmptyLibrary: Story = { args: { profile: newReaderProfile, currentlyReading: undefined, achievement: undefined } };
export const NoSeries: Story = { args: { profile: { ...readerProfile, favorites: { ...readerProfile.favorites, series: undefined } } } };
export const SparseVisitor: Story = { args: { profile: newReaderProfile, mode: 'visitor' } };
export const LongNamesMissingCover: Story = { args: { profile: longReaderProfile, currentlyReading: profileCatalog.book[2] } };
export const SaveError: Story = { render: args => <ProfileReview {...args} saveBehavior="fail-once" /> };
export const PendingSave: Story = { render: args => <ProfileReview {...args} saveBehavior="slow" /> };

export const SetupAndReopen: Story = {
  args: FirstLogin.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let dialog = within(await dialogFor(canvasElement));
    await expect(dialog.getByRole('heading', { name: 'Make this profile yours' })).toHaveFocus();
    for (const kind of favoriteKinds) {
      const select = dialog.getByRole('combobox', { name: `Favorite ${kind}` });
      await expect(select).toHaveValue('');
      await userEvent.selectOptions(select, profileCatalog[kind][0].id);
    }
    await userEvent.click(dialog.getByRole('button', { name: 'Save profile' }));
    await waitForClose(canvasElement);
    await expect(canvas.getByText('An Atlas of Quiet Places')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    dialog = within(await dialogFor(canvasElement));
    for (const kind of favoriteKinds) await expect(dialog.getByRole('combobox', { name: `Favorite ${kind}` })).toHaveValue(profileCatalog[kind][0].id);
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  },
};
export const SkipSetup: Story = {
  args: FirstLogin.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = within(await dialogFor(canvasElement));
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Favorite author' }), 'mira');
    await userEvent.click(dialog.getByRole('button', { name: 'Skip for now' }));
    await waitForClose(canvasElement);
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Edit profile' })).toHaveFocus());
    await expect(canvas.getAllByText('No favorite chosen yet')).toHaveLength(4);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    await expect(within(await dialogFor(canvasElement)).getByRole('combobox', { name: 'Favorite author' })).toHaveValue('');
    await userEvent.keyboard('{Escape}');
  },
};
export const EditCancelAndClear: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Edit profile' });
    await userEvent.click(trigger);
    let dialog = within(await dialogFor(canvasElement));
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Favorite book' }), 'garden');
    await userEvent.clear(dialog.getByRole('textbox', { name: 'Display name' }));
    await userEvent.type(dialog.getByRole('textbox', { name: 'Display name' }), 'Rowan Vale');
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitForClose(canvasElement);
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(canvas.getByRole('heading', { name: 'Eden Reed' })).toBeVisible();
    await expect(canvas.getByText('An Atlas of Quiet Places')).toBeVisible();
    await userEvent.click(trigger);
    dialog = within(await dialogFor(canvasElement));
    for (const kind of favoriteKinds) await userEvent.selectOptions(dialog.getByRole('combobox', { name: `Favorite ${kind}` }), '');
    await userEvent.click(dialog.getByRole('button', { name: 'Save profile' }));
    await waitForClose(canvasElement);
    await waitFor(() => expect(canvas.getAllByText('No favorite chosen yet')).toHaveLength(4));
    await userEvent.click(trigger);
    dialog = within(await dialogFor(canvasElement));
    for (const kind of favoriteKinds) await expect(dialog.getByRole('combobox', { name: `Favorite ${kind}` })).toHaveValue('');
    await userEvent.keyboard('{Escape}');
  },
};
export const ReplaceFavorites: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    let dialog = within(await dialogFor(canvasElement));
    for (const kind of favoriteKinds) await userEvent.selectOptions(dialog.getByRole('combobox', { name: `Favorite ${kind}` }), profileCatalog[kind][1].id);
    await userEvent.click(dialog.getByRole('button', { name: 'Save profile' }));
    await waitForClose(canvasElement);
    for (const kind of favoriteKinds) await expect(within(canvas.getByRole('region', { name: 'Reading favorites' })).getByText(profileCatalog[kind][1].name, { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    dialog = within(await dialogFor(canvasElement));
    for (const kind of favoriteKinds) await expect(dialog.getByRole('combobox', { name: `Favorite ${kind}` })).toHaveValue(profileCatalog[kind][1].id);
    await userEvent.keyboard('{Escape}');
  },
};
export const FailedDraftAndRetry: Story = {
  render: SaveError.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    const dialog = within(await dialogFor(canvasElement));
    await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Favorite book' }), 'garden');
    await userEvent.click(dialog.getByRole('button', { name: 'Save profile' }));
    await expect(await dialog.findByRole('alert')).toHaveTextContent('Your choices are still here');
    await expect(dialog.getByRole('combobox', { name: 'Favorite book' })).toHaveValue('garden');
    await userEvent.click(dialog.getByRole('button', { name: 'Save profile' }));
    await waitForClose(canvasElement);
    await expect(canvas.getByText('A Garden After Rain')).toBeVisible();
  },
};
export const ProtectPendingSave: Story = {
  render: PendingSave.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    const dialog = within(await dialogFor(canvasElement));
    await userEvent.dblClick(dialog.getByRole('button', { name: 'Save profile' }));
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await expect(dialog.getByRole('combobox', { name: 'Favorite genre' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expect(dialog.getByRole('heading')).toBeVisible();
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 5000 });
    await expect(canvas.getByText('Local save completed · 1 request')).toBeVisible();
  },
};
export const PublicPreviewAndReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Preview public profile' });
    trigger.focus(); await userEvent.keyboard('{Enter}');
    let dialog = within(await dialogFor(canvasElement));
    await expect(dialog.getByRole('heading', { name: 'Public profile preview' })).toHaveFocus();
    await expect(dialog.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    await expect(dialog.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    await expect(dialog.queryByRole('heading', { name: 'Currently reading' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitForClose(canvasElement);
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    dialog = within(await dialogFor(canvasElement));
    await userEvent.click(dialog.getByRole('button', { name: 'Back to your profile' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const VisitorActions: Story = {
  args: Visitor.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Start a conversation' }));
    await expect(canvas.getByText('Conversation requested — preview only')).toBeVisible();
  },
};
export const ActivityKeepsChosenFavorites: Story = {
  render: args => <ProfileReview {...args} activityControl />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Simulate reading activity' }));
    await expect(canvas.getByRole('button', { name: /A Garden After Rain/ })).toBeVisible();
    for (const kind of favoriteKinds) await expect(canvas.getByText(profileCatalog[kind][0].name, { exact: true })).toBeVisible();
  },
};
