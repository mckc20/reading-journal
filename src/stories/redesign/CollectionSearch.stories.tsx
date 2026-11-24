import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CollectionSearch, type CollectionSearchItem } from '@/components/redesign/CollectionSearch';
import { HomeShell } from '@/components/redesign/HomeShell';
import '@/components/redesign/library-preview.css';

// Controlled collection examples, not implementations of the author/series/genre pages.
const collections: Record<string, CollectionSearchItem[]> = {
  Authors: [{ id: 'becky', name: 'Becky Chambers' }, { id: 'susanna', name: 'Susanna Clarke' }],
  Series: [{ id: 'monk', name: 'Monk & Robot' }, { id: 'wayfarers', name: 'Wayfarers' }],
  Genres: [{ id: 'scifi', name: 'Science fiction' }, { id: 'fantasy', name: 'Fantasy' }],
};

function ScopedCollection({ initialCollection }: { initialCollection: string }) {
  const [collection, setCollection] = useState(initialCollection);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const items = collections[collection];
  const noop = () => {};
  return <HomeShell activeDestination="Library" onNavigate={noop} onCreate={noop} onNotifications={noop}>
    <CollectionSearch key={collection} collection={collection} items={items} query={query} onQueryChange={setQuery} onSelect={id => setNotice(`Open ${collection.toLowerCase()}: ${items.find(item => item.id === id)?.name}`)}>
    {({ desktopSearch }) => <div className="rj-library-preview">
      <header className="rj-library-heading"><h1>{collection}</h1></header>
      <nav className="rj-library-collections" aria-label="Library collections">{Object.keys(collections).map(name => <button key={name} aria-current={collection === name ? 'page' : undefined} onClick={() => { setCollection(name); setQuery(''); setNotice(''); }}>{name}</button>)}</nav>
      <div className="rj-library-tools">{desktopSearch}</div>
      <ul aria-label={`Library ${collection.toLowerCase()}`}>{items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())).map(item => <li key={item.id}>{item.name}</li>)}</ul>
      {notice && <p role="status">{notice} — preview only.</p>}
    </div>}
    </CollectionSearch>
  </HomeShell>;
}

const meta = {
  title: 'Redesign/Collection Search', component: ScopedCollection,
  args: { initialCollection: 'Authors' }, parameters: { layout: 'fullscreen', docs: { description: { component: 'Small scoping examples for the reusable search pattern. Authors searches author names, Series searches series titles, Genres searches genres. These are fictional search samples, not full redesigned collection pages. Mobile below 768px uses the same swipe reveal/full-screen search as Books; wider screens keep inline search.' } } },
} satisfies Meta<typeof ScopedCollection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Authors: Story = {};
export const Series: Story = { args: { initialCollection: 'Series' } };
export const Genres: Story = { args: { initialCollection: 'Genres' } };
export const SearchStaysInCollection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      const searchButton = canvas.getByRole('button', { name: 'Search your authors' });
      searchButton.focus();
      await userEvent.keyboard('{Enter}');
    }
    const body = within(canvasElement.ownerDocument.body);
    const scope = mobile ? within(await body.findByRole('dialog')) : canvas;
    const input = scope.getByRole('searchbox', { name: 'Search your authors' });
    await userEvent.type(input, 'Psalm');
    if (mobile) await expect(scope.getByText('No authors found. Try another search.')).toBeVisible();
    else await expect(canvas.getByRole('list', { name: 'Library authors' }).children).toHaveLength(0);
    await userEvent.clear(input);
    await userEvent.type(input, 'chambers');
    if (mobile) {
      await userEvent.click(scope.getByRole('button', { name: 'Becky Chambers' }));
      await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
      await expect(canvas.getByRole('status')).toHaveTextContent('Open authors: Becky Chambers');
    } else await expect(canvas.getByRole('list', { name: 'Library authors' }).children).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Series' }));
    if (mobile) {
      const searchButton = canvas.getByRole('button', { name: 'Search your series' });
      searchButton.focus();
      await userEvent.keyboard('{Enter}');
    }
    const seriesScope = mobile ? within(await body.findByRole('dialog')) : canvas;
    await userEvent.type(seriesScope.getByRole('searchbox', { name: 'Search your series' }), 'Chambers');
    if (mobile) await expect(seriesScope.getByText('No series found. Try another search.')).toBeVisible();
    else await expect(canvas.getByRole('list', { name: 'Library series' }).children).toHaveLength(0);
  },
};
