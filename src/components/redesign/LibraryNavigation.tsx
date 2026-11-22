export type LibraryDestination = 'Books' | 'Collections' | 'Series';

export function LibraryNavigation({ current, onNavigate }: {
  current: LibraryDestination;
  onNavigate: (destination: LibraryDestination) => void;
}) {
  return <nav className="rj-library-collections" aria-label="Library collections">
    {(['Books', 'Collections', 'Series'] as const).map(name => <button key={name} aria-current={current === name ? 'page' : undefined} onClick={() => onNavigate(name)}>{name}</button>)}
  </nav>;
}
