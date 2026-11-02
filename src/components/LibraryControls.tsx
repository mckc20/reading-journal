import { useId } from "react";
import { ArrowDownUp, Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { collectionSelectClassName, collectionSelectFieldClassName } from "@/components/ui/collection-select";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

const collectionMenuClassName = "z-50 max-h-[min(18rem,var(--radix-dropdown-menu-content-available-height))] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-input bg-background p-1 text-sm text-foreground shadow-sm";
const collectionMenuItemClassName = "relative flex min-h-8 w-full cursor-default items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

export function FilterSelect({ label, value, options, onChange, emptyLabel = "All", triggerClassName, disabled = false }: {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const selectedLabel = value.length === 0 ? emptyLabel : value.length === 1 ? value[0] : `${value.length} selected`;
  return (
    <div className={collectionSelectFieldClassName}>
      <label htmlFor={id}>{label}</label>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button id={id} type="button" disabled={disabled} aria-label={label}
            className={cn(collectionSelectClassName, "flex items-center justify-between gap-2 text-left disabled:opacity-50", triggerClassName)}>
            <span className="min-w-0 truncate">{selectedLabel}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className={collectionMenuClassName}>
            <DropdownMenu.Item onSelect={() => onChange("")} className={collectionMenuItemClassName}>
              <span className="flex-1">{emptyLabel}</span>
              {value.length === 0 && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
            </DropdownMenu.Item>
            {options.map((option) => (
              <DropdownMenu.CheckboxItem key={option} checked={value.includes(option)}
                onCheckedChange={() => onChange(option)} onSelect={(event) => event.preventDefault()}
                className={collectionMenuItemClassName}>
                <span className="flex-1">{option}</span>
                <DropdownMenu.ItemIndicator><Check aria-hidden="true" className="h-3.5 w-3.5" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function SortOptionContent({ label, directionLabel, active }: {
  label: string;
  directionLabel: string;
  active: boolean;
}) {
  return (
    <>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        {active && <ArrowDownUp className="h-4 w-4" />}
      </span>
      <span>{label}</span>
      <span className="ml-auto pl-4 text-xs text-muted-foreground">{directionLabel}</span>
    </>
  );
}

export function LibrarySortingControls({ sort, options, directionLabel, onSortChange, onDirectionChange, compact = false }: {
  sort: string;
  options: ReadonlyArray<{ value: string; label: string; directionLabel: string }>;
  directionLabel: string;
  onSortChange: (value: string) => void;
  onDirectionChange: () => void;
  compact?: boolean;
}) {
  const chooseSort = (value: string) => {
    if (value === sort) onDirectionChange();
    else onSortChange(value);
  };
  const optionLabel = (option: typeof options[number]) => option.value === sort ? directionLabel : option.directionLabel;
  const id = useId();
  const selected = options.find((option) => option.value === sort);

  // A menu fires on every selection, including the current sort, so it can reverse.
  return (
    <div className={cn(collectionSelectFieldClassName, compact && "hidden lg:flex")}>
      <label htmlFor={id}>Sort by</label>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button id={id} type="button" className={cn(collectionSelectClassName, "flex items-center justify-between gap-3 text-left")}
            aria-label={`Sort by: ${selected?.label}, ${directionLabel}`}>
            <span>{selected?.label}</span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align={compact ? "end" : "start"} sideOffset={4} className={cn(collectionMenuClassName, "min-w-72")}>
            {options.map((option) => (
              <DropdownMenu.Item key={option.value} onSelect={() => chooseSort(option.value)} aria-current={option.value === sort ? "true" : undefined}
                className={collectionMenuItemClassName}>
                <SortOptionContent label={option.label} directionLabel={optionLabel(option)} active={option.value === sort} />
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function LibraryFilterChips({ chips, onClear }: {
  chips: Array<{ label: string; onRemove: () => void }>;
  onClear: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge key={chip.label} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button type="button" className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label={`Remove ${chip.label}`} onClick={chip.onRemove}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>Clear filters</Button>
    </div>
  );
}
