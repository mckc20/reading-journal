import type { ReactNode } from 'react';
import { Bell, Book, BookPlus, Compass, Feather, Home, NotebookPen, Plus, Star, UserRound, Layers } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import logo from '@/assets/rj-logo-transparent.png';

export type HomeDestination = 'Home' | 'Library' | 'Journal' | 'Insights' | 'Profile';
export type CreateDestination = 'book' | 'entry' | 'series';
const destinations = [
  { name: 'Home', icon: Home }, { name: 'Library', icon: Book },
  { name: 'Journal', icon: Feather }, { name: 'Insights', icon: Compass },
  { name: 'Profile', icon: UserRound },
] as const;

export function AddLauncher({ onCreate }: { onCreate: (destination: CreateDestination) => void }) {
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><Button className="rj-add-trigger" size="icon-lg" aria-label="Add"><Plus /></Button></DropdownMenu.Trigger>
    {/* Keep the menu inside the theme scope; Radix still provides keyboard and focus behavior. */}
    <DropdownMenu.Content className="rj-add-menu rj-create-menu" side="top" align="end" sideOffset={8} collisionPadding={16}>
      {([{ value: 'book', label: 'Add a book', icon: BookPlus }, { value: 'entry', label: 'Add a journal entry', icon: NotebookPen }, { value: 'series', label: 'Add a book series', icon: Layers }] as const).map(item =>
        <DropdownMenu.Item key={item.value} onSelect={() => onCreate(item.value)}><span className="rj-create-label">{item.label}</span><span className="rj-create-icon"><item.icon size={22} /></span></DropdownMenu.Item>)}
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}

export function HomeShell({ children, onNavigate, onCreate, onNotifications, onWishlist }: {
  children: ReactNode; onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void; onNotifications: () => void; onWishlist: () => void;
}) {
  return <div className="rj-home-shell">
    <a className="rj-skip-link" href="#redesign-home-content">Skip to content</a>
    <header className="rj-app-header">
      <button className="rj-brand" onClick={() => onNavigate('Home')} aria-label="Reading Journal home"><img src={logo} alt="" /><span>Reading Journal</span></button>
      <div className="rj-header-actions"><Button variant="ghost" size="icon-lg" onClick={onWishlist} aria-label="Wishlist"><Star /></Button><Button variant="ghost" size="icon-lg" onClick={onNotifications} aria-label="Notifications"><Bell /></Button></div>
    </header>
    <nav className="rj-navigation" aria-label="Main navigation">
      {destinations.map(({ name, icon: Icon }) => <button key={name} aria-current={name === 'Home' ? 'page' : undefined} onClick={() => onNavigate(name)}><Icon size={22} aria-hidden="true" /><span>{name}</span></button>)}
    </nav>
    <main id="redesign-home-content" tabIndex={-1}>{children}</main>
    <div className="rj-floating-add"><AddLauncher onCreate={onCreate} /></div>
  </div>;
}
