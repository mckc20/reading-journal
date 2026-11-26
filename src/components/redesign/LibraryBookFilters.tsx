import { ListFilter } from 'lucide-react';
import { useRef, useState } from 'react';
import { FilterSelect } from '@/components/LibraryControls';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { filterLabels, type LibraryFilterKey, type LibraryFilterOptions, type LibraryFilters } from '@/lib/libraryBookFilters';

const groups = [
  { title: 'Reading', keys: ['status', 'rating', 'year'] },
  { title: 'Browse by', keys: ['genre', 'author', 'series'] },
  { title: 'Edition and source', keys: ['format', 'language', 'source', 'publicationYear', 'catalogue'] },
] as const satisfies readonly { title: string; keys: readonly LibraryFilterKey[] }[];

export function LibraryBookFilters({ filters, options, count, onToggle, onClear, focusedFilter, onCloseLink }: {
  filters: LibraryFilters;
  options: LibraryFilterOptions;
  count: number;
  onToggle: (key: LibraryFilterKey, value: string) => void;
  onClear: () => void;
  focusedFilter?: 'author' | 'genre';
  onCloseLink?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const fields = useRef<HTMLDivElement>(null);

  return <Dialog open={open || Boolean(focusedFilter)} onOpenChange={next => {
    setOpen(next);
    if (!next) onCloseLink?.();
  }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="icon-lg" className="rj-books-filter-trigger"
        aria-label="Filter books" data-active={count > 0 || undefined}>
        <ListFilter aria-hidden="true" />
        {count > 0 && <span className="rj-books-filter-count" aria-hidden="true">{count}</span>}
      </Button>
    </DialogTrigger>
    <DialogContent className="rj-redesign rj-books-filter-dialog sm:max-w-lg" onOpenAutoFocus={event => {
      if (!focusedFilter) return;
      const field = fields.current?.querySelector<HTMLSelectElement>(`[data-filter-key="${focusedFilter}"] select:not(:disabled)`);
      if (!field) return;
      event.preventDefault();
      field.focus();
    }}>
      <DialogHeader>
        <DialogTitle>Filter books</DialogTitle>
        <DialogDescription>You can select multiple values in each field.</DialogDescription>
      </DialogHeader>
      <div className="rj-books-filter-groups" ref={fields}>
        {groups.map(group => <fieldset key={group.title}>
          <legend>{group.title}</legend>
          <div className="rj-books-filter-fields">
            {group.keys.map(key => {
              const fieldOptions = [...new Set([...options[key], ...filters[key]])];
              return <div key={key} data-filter-key={key}>
                <FilterSelect label={filterLabels[key]} value={filters[key]} options={fieldOptions}
                  onChange={value => onToggle(key, value)} disabled={fieldOptions.length === 0} nativeMenu />
              </div>;
            })}
          </div>
        </fieldset>)}
      </div>
      <DialogFooter className="rj-books-filter-footer">
        <Button type="button" variant="outline" onClick={onClear} disabled={count === 0}>Clear filters</Button>
        <DialogClose asChild><Button type="button" className="rounded-full">Done</Button></DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
