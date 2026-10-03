interface DeleteSeriesBooksOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function DeleteSeriesBooksOption({ checked, onChange, disabled }: DeleteSeriesBooksOptionProps) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium">Delete linked books too</span>
        <span className="block text-xs text-muted-foreground">
          Includes wishlist books and their journals and reading logs. This cannot be undone.
          Leave unchecked to keep the books and remove only their series link.
        </span>
      </span>
    </label>
  );
}
