import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CollectionSearch } from '@/components/redesign/CollectionSearch';
import { HomeShell } from '@/components/redesign/HomeShell';
import '@/components/redesign/library-preview.css';

// Controlled collection examples, not implementations of the author/series/genre pages.
const collections: Record<string, { id: string; name: string }[]> = {
  Authors: [{ id: 'becky', name: 'Becky Chambers' }, { id: 'susanna', name: 'Susanna Clarke' }],
  Series: [{ id: 'monk', name: 'Monk & Robot' }, { id: 'wayfarers', name: 'Wayfarers' }],
  Genres: [{ id: 'scifi', name: 'Science fiction' }, { id: 'fantasy', name: 'Fantasy' }],
};

function ScopedCollection({ initialCollection }: { initialCollection: string }) {
  const [collection, setCollection] = useState(initialCollection);
  const [query, setQuery] = useState('');
  const items = collections[collection];
  const noop = () => {};
  return <HomeShell activeDestination="Library" onNavigate={noop} onCreate={noop} onNotifications={noop}>
    <header className="rj-library-heading"><h1>{collection}</h1></header>
    <nav className="rj-library-collections" aria-label="Library collections">{Object.keys(collections).map(name => <button key={name} aria-current={collection === name ? 'page' : undefined} onClick={() => { setCollection(name); setQuery(''); }}>{name}</button>)}</nav>
    <CollectionSearch key={collection} collection={collection} query={query} onQueryChange={setQuery}>
      {({ desktopSearch }) => <div className="rj-library-preview">
        <div className="rj-library-search-toolbar">{desktopSearch}</div>
        <ul aria-label={`Library ${collection.toLowerCase()}`}>{items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())).map(item => <li key={item.id}>{item.name}</li>)}</ul>
      </div>}
    </CollectionSearch>
  </HomeShell>;
}

const meta = {
  title: 'Redesign/Collection Search', component: ScopedCollection,
  args: { initialCollection: 'Authors' }, parameters: { layout: 'fullscreen', docs: { description: { component: 'Small scoping examples for the reusable search pattern. Authors searches author names, Series searches series titles, Genres searches genres. These are fictional search samples, not full redesigned collection pages. Mobile below 768px reveals the inline search on a downward swipe. On wider screens the search stays visible.' } } },
} satisfies Meta<typeof ScopedCollection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Authors: Story = {};
export const Series: Story = { args: { initialCollection: 'Series' } };
export const Genres: Story = { args: { initialCollection: 'Genres' } };
export const SearchStaysInCollection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('searchbox', { name: 'Search your authors' });
    input.focus();
    await userEvent.type(input, 'Psalm');
    await expect(canvas.getByRole('list', { name: 'Library authors' }).children).toHaveLength(0);
    await userEvent.clear(input);
    await userEvent.type(input, 'chambers');
    await expect(canvas.getByRole('list', { name: 'Library authors' }).children).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Series' }));
    const seriesSearch = canvas.getByRole('searchbox', { name: 'Search your series' });
    await expect(seriesSearch).toHaveValue('');
    seriesSearch.focus();
    await userEvent.type(seriesSearch, 'Chambers');
    await expect(canvas.getByRole('list', { name: 'Library series' }).children).toHaveLength(0);
  },
};
