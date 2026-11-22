import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BookLookupMode } from './bookFormTypes';

export function BookLookupModeSwitch({ mode, onChange, disabled }: {
  mode: BookLookupMode;
  onChange: (mode: BookLookupMode) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="rj-lookup-modes" disabled={disabled}>
      <legend>Search by</legend>
      {(['isbn', 'title'] as const).map(value => (
        <label key={value}>
          <input type="radio" name={id} checked={mode === value} onChange={() => onChange(value)} />
          {value === 'isbn' ? 'ISBN' : 'Book title'}
        </label>
      ))}
    </fieldset>
  );
}

export function mergeBookNames(selected: string[], query: string): string[] {
  const unique = new Map<string, string>();
  for (const value of [...selected, ...query.split(';')]) {
    const name = value.trim().replace(/\s+/g, ' ');
    const key = name.toLocaleLowerCase();
    if (name && !unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}

interface BookFormTagFieldProps {
  kind: 'authors' | 'genres';
  query: string;
  selected: { id: string; label: string }[];
  options: string[];
  onQueryChange: (query: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  error?: string;
  catalogOnly?: boolean;
}

export function BookFormTagField({ kind, query, selected, options, onQueryChange, onAdd, onRemove, error, catalogOnly }: BookFormTagFieldProps) {
  const id = useId();
  const author = kind === 'authors';
  const item = author ? 'author' : 'genre';
  const chosen = new Set(selected.map(value => value.label.toLocaleLowerCase()));
  const suggestions = query.trim().length >= 2
    ? options.filter(option => !chosen.has(option.toLocaleLowerCase()))
    : [];
  return (
    <div className="rj-book-form-field">
      <Label htmlFor={id}>{author ? 'Author' : 'Genres'}</Label>
      <div className="rj-book-tags">
        {selected.map(({ id: value, label }) => (
          <span key={value}>
            {label}
            <button type="button" aria-label={`Remove ${item} ${label}`} onClick={() => onRemove(value)}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="rj-book-tag-input">
        <Input id={id} name={kind} list={`${id}-options`} value={query} autoComplete="off"
          placeholder={catalogOnly ? 'Search genres' : `Choose or type ${author ? 'an' : 'a'} ${item}`}
          onChange={event => onQueryChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onAdd(); } }}
          aria-required={author} aria-invalid={Boolean(error)} aria-describedby={`${id}-${error ? 'error' : 'hint'}`} />
        <Button type="button" variant="outline" aria-label={`Add ${item}`} disabled={!query.trim()} onClick={onAdd}>
          <Plus aria-hidden="true" />Add
        </Button>
      </div>
      <datalist id={`${id}-options`}>
        {suggestions.map(option => <option key={option} value={option} />)}
      </datalist>
      <p id={`${id}-hint`} className="rj-book-form-hint">
        {author ? 'Add one or more authors. Separate names with a semicolon (;).' : catalogOnly ? 'Choose a genre from the catalog.' : 'Add genres to organize this book.'}
      </p>
      {error && <p id={`${id}-error`} className="rj-book-form-error" role="alert">{error}</p>}
    </div>
  );
}
