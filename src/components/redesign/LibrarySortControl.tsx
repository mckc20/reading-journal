import { librarySorts, type LibrarySort } from '@/lib/libraryTabs';

export function LibrarySortControl({ value, onChange }: { value: LibrarySort; onChange: (value: LibrarySort) => void }) {
  return <label className="rj-library-sort">
    <span>Sort by</span>
    <select value={value} onChange={event => {
      const option = librarySorts.find(item => item.value === event.target.value);
      if (option) onChange(option.value);
    }}>
      {librarySorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
