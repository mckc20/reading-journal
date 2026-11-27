import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { BookCover } from "@/components/reading-journal/BookCover";
import { cn } from "@/lib/utils";

interface ReorderableBook {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
}

function ReorderableBookRow({ book, disabled, onRemove, children }: {
  book: ReorderableBook;
  disabled?: boolean;
  onRemove: (id: string, byKeyboard: boolean) => void;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id, disabled });

  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={cn("flex flex-wrap items-center gap-1 rounded-lg border bg-card p-2 shadow-sm transition-shadow",
      isDragging && "relative z-10 shadow-lg")}>
    <button ref={setActivatorNodeRef} type="button" aria-label={`Reorder ${book.title}`} disabled={disabled}
      className="flex size-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
      {...attributes} {...listeners}>
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
    <BookCover src={book.cover} title={book.title} className="w-8 shrink-0" decorative />
    <div className="min-w-0 flex-1 px-1 [overflow-wrap:anywhere]">
      <p className="text-sm font-medium">{book.title}</p>
      <p className="text-xs text-muted-foreground">{book.author || "Unknown author"}</p>
    </div>
    {children}
    <button type="button" aria-label={`Remove ${book.title}`} disabled={disabled}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
      onClick={event => onRemove(book.id, event.detail === 0)}>
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  </li>;
}

export function ReorderableBookList({ books, disabled, onReorder, onRemove, renderDetails }: {
  books: readonly ReorderableBook[];
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string, byKeyboard: boolean) => void;
  renderDetails?: (index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = books.map(book => book.id);

  if (!books.length) return null;

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  }}>
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul aria-label="Selected books" className="space-y-2">
        {books.map((book, index) => <ReorderableBookRow key={book.id} book={book} disabled={disabled} onRemove={onRemove}>
          {renderDetails?.(index)}
        </ReorderableBookRow>)}
      </ul>
    </SortableContext>
  </DndContext>;
}
