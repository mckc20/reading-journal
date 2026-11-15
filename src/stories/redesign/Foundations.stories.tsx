import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { BookStatus } from '@/components/reading-journal/BookStatus';
import type { BookStatus as Status } from '@/types';

const meta = { title: 'Redesign/Foundations', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const VisualLanguage: Story = { render: () => <div className="rj-foundations">
  <p className="rj-eyebrow">Reading Journal · Design workshop</p>
  <h1 style={{ font: 'italic 36px var(--font-display)', marginTop: 12 }}>Your place, for your books.</h1>
  <p style={{ marginTop: 16 }}>Lora for expressive headings. DM Sans for clear, comfortable everyday reading.</p>
  <div className="rj-foundation-colors">{[['Paper', 'var(--background)'], ['Surface', 'var(--card)'], ['Muted blue', 'var(--rj-blue)'], ['Rose', 'var(--rj-rose)'], ['Light rose', 'var(--rj-rose-light)'], ['Gold', 'var(--rj-gold)'], ['Ink', 'var(--foreground)']].map(([name, color]) => <div key={name}><span style={{ background: color }} />{name}</div>)}</div>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBlock: 24 }}><Button>Save progress</Button><Button variant="outline">Cancel</Button><Button variant="secondary">Secondary</Button><Button disabled>Saving…</Button><Button variant="destructive">Delete entry</Button></div>
  <p className="rj-eyebrow">Existing status semantics retained for review</p>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>{(['Wishlist', 'To Read', 'Up Next', 'Reading', 'Paused', 'Finished', 'DNF'] satisfies Status[]).map(status => <BookStatus key={status} status={status} />)}</div>
</div> };
