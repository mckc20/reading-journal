export function LibrarySortControl<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return <label className="rj-library-sort">
    <span>Sort by</span>
    <select value={value} onChange={event => {
      const option = options.find(item => item.value === event.target.value);
      if (option) onChange(option.value);
    }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
