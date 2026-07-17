import { useRef, useState, type KeyboardEvent } from "react";
import {
  Bold,
  CircleAlert,
  CircleQuestionMark,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  Lightbulb,
  MessageSquarePlus,
  Minus,
  Pencil,
  Quote,
  Eye,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NoteCalloutType } from "@/lib/noteFormatting";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  placeholder?: string;
  minHeightClassName?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

type SelectionRange = {
  start: number;
  end: number;
};

const CALLOUT_OPTIONS: Array<{ type: NoteCalloutType; label: string; Icon: LucideIcon }> = [
  { type: "note", label: "Note", Icon: StickyNote },
  { type: "idea", label: "Idea", Icon: Lightbulb },
  { type: "question", label: "Question", Icon: CircleQuestionMark },
  { type: "favorite", label: "Favorite", Icon: Star },
  { type: "spoiler", label: "Spoiler", Icon: CircleAlert },
];

function selectedLines(value: string, selection: SelectionRange) {
  const lineStart = value.lastIndexOf("\n", Math.max(selection.start - 1, 0)) + 1;
  const nextLineBreak = value.indexOf("\n", selection.end);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;

  return {
    lineStart,
    lineEnd,
    text: value.slice(lineStart, lineEnd),
  };
}

function stripListMarker(line: string): string {
  return line.replace(/^(\s*)(?:[-*]\s+|\d+\.\s+)/, "$1");
}

export default function MarkdownEditor({
  id,
  value,
  placeholder,
  minHeightClassName = "min-h-56",
  onChange,
  onBlur,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSelectionRef = useRef<SelectionRange>({ start: 0, end: 0 });
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [calloutMenuOpen, setCalloutMenuOpen] = useState(false);

  function currentSelection(): SelectionRange {
    const textarea = textareaRef.current;
    if (!textarea) return lastSelectionRef.current;

    const selection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
    lastSelectionRef.current = selection;
    return selection;
  }

  function focusSelection(start: number, end = start) {
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
      lastSelectionRef.current = { start, end };
    });
  }

  function replaceSelection(nextValue: string, nextSelection: SelectionRange) {
    onChange(nextValue);
    setMode("edit");
    focusSelection(nextSelection.start, nextSelection.end);
  }

  function wrapSelection(prefix: string, suffix: string, fallback: string) {
    const selection = currentSelection();
    const selectedText = value.slice(selection.start, selection.end);
    const inner = selectedText || fallback;
    const nextText = `${prefix}${inner}${suffix}`;
    const nextValue = value.slice(0, selection.start) + nextText + value.slice(selection.end);
    const innerStart = selection.start + prefix.length;

    replaceSelection(nextValue, {
      start: selectedText ? selection.start + nextText.length : innerStart,
      end: selectedText ? selection.start + nextText.length : innerStart + fallback.length,
    });
  }

  function transformSelectedLines(transform: (line: string, index: number, lines: string[]) => string) {
    const selection = currentSelection();
    const block = selectedLines(value, selection);
    const lines = block.text.split("\n");
    const nextText = lines.map(transform).join("\n");
    const nextValue = value.slice(0, block.lineStart) + nextText + value.slice(block.lineEnd);

    replaceSelection(nextValue, {
      start: block.lineStart,
      end: block.lineStart + nextText.length,
    });
  }

  function toggleQuote() {
    transformSelectedLines((line, _index, lines) => {
      const allQuoted = lines.every((item) => item.trim() === "" || item.startsWith("> "));
      if (allQuoted) return line.replace(/^> ?/, "");
      return line.trim() ? `> ${line}` : ">";
    });
  }

  function toggleBulletList() {
    transformSelectedLines((line, _index, lines) => {
      const allBullets = lines.every((item) => item.trim() === "" || /^\s*[-*]\s+/.test(item));
      if (allBullets) return stripListMarker(line);
      return line.trim() ? line.replace(/^(\s*)/, "$1- ") : line;
    });
  }

  function toggleNumberedList() {
    transformSelectedLines((line, index, lines) => {
      const allNumbered = lines.every((item) => item.trim() === "" || /^\s*\d+\.\s+/.test(item));
      if (allNumbered) return stripListMarker(line);
      return line.trim() ? line.replace(/^(\s*)/, `$1${index + 1}. `) : line;
    });
  }

  function cycleHeading() {
    transformSelectedLines((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (!match) return line.trim() ? `# ${line}` : line;
      if (match[1] === "#") return `## ${match[2]}`;
      if (match[1] === "##") return `### ${match[2]}`;
      return match[2];
    });
  }

  function insertDivider() {
    const selection = currentSelection();
    const before = value.slice(0, selection.start);
    const after = value.slice(selection.end);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n" : "";
    const divider = `${prefix}---${suffix}`;
    const nextValue = before + divider + after;
    const cursor = before.length + divider.length;

    replaceSelection(nextValue, { start: cursor, end: cursor });
  }

  function insertLink() {
    const selection = currentSelection();
    const selectedText = value.slice(selection.start, selection.end) || "text";
    const nextText = `[${selectedText}](url)`;
    const nextValue = value.slice(0, selection.start) + nextText + value.slice(selection.end);
    const urlStart = selection.start + selectedText.length + 3;

    replaceSelection(nextValue, { start: urlStart, end: urlStart + 3 });
  }

  function insertCallout(type: NoteCalloutType) {
    const selection = currentSelection();
    const selectedText = value.slice(selection.start, selection.end);
    const content = selectedText
      ? selectedText.split("\n").map((line) => `> ${line}`).join("\n")
      : "> ";
    const nextText = `> [!${type}]\n${content}`;
    const nextValue = value.slice(0, selection.start) + nextText + value.slice(selection.end);
    const cursor = selectedText ? selection.start + nextText.length : selection.start + nextText.length;

    setCalloutMenuOpen(false);
    replaceSelection(nextValue, { start: cursor, end: cursor });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey)) return;

    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "bold text");
    }

    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      wrapSelection("*", "*", "italic text");
    }
  }

  return (
    <div className="rounded-md border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("**", "**", "bold text")}>
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection("*", "*", "italic text")}>
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Heading" title="Heading" onMouseDown={(event) => event.preventDefault()} onClick={cycleHeading}>
            <Heading className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Bullet list" title="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={toggleBulletList}>
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={toggleNumberedList}>
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Quote" title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={toggleQuote}>
            <Quote className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Divider" title="Divider" onMouseDown={(event) => event.preventDefault()} onClick={insertDivider}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" title="Link" onMouseDown={(event) => event.preventDefault()} onClick={insertLink}>
            <Link className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Callout"
              title="Callout"
              aria-expanded={calloutMenuOpen}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                lastSelectionRef.current = currentSelection();
                setCalloutMenuOpen((current) => !current);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            {calloutMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]">
                {CALLOUT_OPTIONS.map(({ Icon, ...option }) => (
                  <button
                    key={option.type}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertCallout(option.type)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex rounded-md border bg-background p-0.5">
          <Button type="button" variant={mode === "edit" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("edit")}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button type="button" variant={mode === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("preview")}>
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className={cn("px-3 py-3 text-sm leading-6", minHeightClassName)}>
          {value.trim() ? (
            <FormattedNoteContent markdown={value} />
          ) : (
            <p className="text-muted-foreground">{placeholder}</p>
          )}
        </div>
      ) : (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onSelect={currentSelection}
          onKeyUp={currentSelection}
          onClick={currentSelection}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={cn("resize-y border-0 bg-transparent text-sm leading-6 shadow-none focus-visible:ring-0", minHeightClassName)}
        />
      )}
    </div>
  );
}
