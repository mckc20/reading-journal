import { useRef, type ReactNode } from 'react';
import { Bell, Book, BookPlus, Compass, Feather, Home, NotebookPen, Plus, UserRound, Layers } from 'lucide-react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function prepareLaunch() {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    // Measure only after Radix has positioned the menu. This also supports a
    // flipped menu near a viewport edge: every circle starts at the actual +.
    menu.removeAttribute('data-motion-ready');
    const origin = trigger.getBoundingClientRect();
    const rows = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(row => {
      const circle = row.querySelector<HTMLElement>('.rj-create-icon')!;
      const bounds = circle.getBoundingClientRect();
      const x = origin.x + origin.width / 2 - bounds.x - bounds.width / 2;
      const y = origin.y + origin.height / 2 - bounds.y - bounds.height / 2;
      return { row, x, y };
    }).sort((a, b) => Math.abs(a.y) - Math.abs(b.y));
    rows.forEach(({ row, x, y }, index) => {
      row.style.setProperty('--rj-launch-x', `${x}px`);
      row.style.setProperty('--rj-launch-y', `${y}px`);
      row.style.setProperty('--rj-launch-delay', `${index * 55}ms`);
      row.style.setProperty('--rj-label-delay', `${130 + index * 55}ms`);
      row.style.setProperty('--rj-launch-overshoot', y > 0 ? '-4px' : '4px');
    });
    menu.setAttribute('data-motion-ready', 'true');
  }

  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><Button ref={triggerRef} className="rj-add-trigger" size="icon-lg" aria-label="Add"><Plus /></Button></DropdownMenu.Trigger>
    {/* Keep the menu inside the theme scope; Radix still provides keyboard and focus behavior. */}
    <DropdownMenu.Content
      ref={menuRef}
      className="rj-add-menu rj-create-menu"
      side="top" align="end" sideOffset={8} collisionPadding={16}
      onAnimationStart={event => {
        if (event.target === event.currentTarget && event.animationName === 'rj-create-menu-ready') prepareLaunch();
      }}
    >
      {([{ value: 'book', label: 'Add a book', icon: BookPlus }, { value: 'entry', label: 'Add a journal entry', icon: NotebookPen }, { value: 'series', label: 'Add a book series', icon: Layers }] as const).map(item =>
        <DropdownMenu.Item key={item.value} onSelect={() => onCreate(item.value)}><span className="rj-create-label">{item.label}</span><span className="rj-create-icon"><item.icon size={22} /></span></DropdownMenu.Item>)}
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}

export function HomeShell({ children, onNavigate, onCreate, onNotifications, navigationPlacement = 'responsive' }: {
  children: ReactNode; onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void; onNotifications: () => void;
  navigationPlacement?: 'responsive' | 'footer';
}) {
  const navigation = <nav className="rj-navigation" aria-label="Main navigation">
    {destinations.map(({ name, icon: Icon }) => <button key={name} aria-current={name === 'Home' ? 'page' : undefined} onClick={() => onNavigate(name)}><Icon size={22} aria-hidden="true" /><span>{name}</span></button>)}
  </nav>;
  return <div className="rj-home-shell">
    <a className="rj-skip-link" href="#redesign-home-content">Skip to content</a>
    <header className="rj-app-header">
      <button className="rj-brand" onClick={() => onNavigate('Home')} aria-label="Reading Journal home"><img src={logo} alt="" /><span>Reading Journal</span></button>
      {navigationPlacement === 'responsive' && navigation}
      <div className="rj-header-actions"><Button variant="ghost" size="icon-lg" onClick={onNotifications} aria-label="Notifications"><Bell /></Button></div>
    </header>
    {navigationPlacement === 'footer' && navigation}
    <main id="redesign-home-content" tabIndex={-1}>{children}</main>
    <div className="rj-floating-add"><AddLauncher onCreate={onCreate} /></div>
  </div>;
}
