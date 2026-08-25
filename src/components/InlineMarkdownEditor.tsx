import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import LinkExtension from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading, Italic, Link, List, ListOrdered, Quote } from "lucide-react";
import JournalEntryLinkPicker from "@/components/JournalEntryLinkPicker";
import { Button } from "@/components/ui/button";
import type { JournalLinkTarget } from "@/lib/journalLinks";
import { cn } from "@/lib/utils";

interface InlineMarkdownEditorProps {
  id?: string;
  value: string;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
  autoFocus?: boolean;
  entryLinkTargets?: JournalLinkTarget[];
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export interface InlineMarkdownEditorHandle {
  insertTextAtCursor: (text: string) => void;
}

function editorMarkdown(editor: NonNullable<ReturnType<typeof useEditor>>): string {
  const maybeMarkdownEditor = editor as typeof editor & { getMarkdown?: () => string };
  return maybeMarkdownEditor.getMarkdown?.() ?? editor.getText();
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

const InlineMarkdownEditor = forwardRef<InlineMarkdownEditorHandle, InlineMarkdownEditorProps>(function InlineMarkdownEditor({
  id,
  value,
  placeholder = "Start writing...",
  minHeightClassName = "min-h-32",
  className,
  autoFocus = false,
  entryLinkTargets = [],
  onChange,
  onBlur,
}, ref) {
  const [entryLinkPickerOpen, setEntryLinkPickerOpen] = useState(false);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Markdown.configure({
        markedOptions: {
          breaks: true,
          gfm: true,
        },
      }),
    ],
    [],
  );
  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: id ?? "",
        class: cn(
          "journal-markdown inline-journal-editor max-w-none border-0 bg-transparent text-base leading-8 text-foreground outline-none",
          minHeightClassName,
        ),
        "aria-label": "Journal entry content",
      },
      handleDOMEvents: {
        blur: () => {
          window.setTimeout(() => onBlur?.(), 120);
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextMarkdown = editorMarkdown(currentEditor);
      onChange(nextMarkdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editorMarkdown(editor) === value) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    const docSize = editor.state.doc.content.size;
    editor.commands.setTextSelection({
      from: Math.min(from, docSize),
      to: Math.min(to, docSize),
    });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !autoFocus) return;
    window.requestAnimationFrame(() => editor.commands.focus("end"));
  }, [autoFocus, editor]);

  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`\n\n${text}\n\n`).run();
      onChange(editorMarkdown(editor));
    },
  }), [editor, onChange]);

  if (!editor) return null;
  const activeEditor = editor;

  function openLinkPicker() {
    setEntryLinkPickerOpen((current) => !current);
  }

  function removeActiveLink() {
    activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
  }

  function applyEntryLink(target: JournalLinkTarget) {
    const { empty } = activeEditor.state.selection;
    setEntryLinkPickerOpen(false);

    if (empty) {
      activeEditor
        .chain()
        .focus()
        .insertContent(`<a href="${escapeHtmlAttribute(target.href)}">${escapeHtmlAttribute(target.label)}</a>`)
        .run();
      return;
    }

    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: target.href }).run();
  }

  return (
    <div className={cn("relative rounded-md border bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Heading" title="Heading" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Quote" title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Bullet list" title="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => activeEditor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <JournalEntryLinkPicker
          open={entryLinkPickerOpen}
          targets={entryLinkTargets}
          canRemoveLink={activeEditor.isActive("link")}
          onOpenChange={setEntryLinkPickerOpen}
          onRemoveLink={removeActiveLink}
          onSelect={applyEntryLink}
          trigger={(
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" title="Link" onMouseDown={(event) => event.preventDefault()} onClick={openLinkPicker}>
              <Link className="h-4 w-4" />
            </Button>
          )}
        />
      </div>

      <div className="relative px-3 py-3">
        <EditorContent editor={activeEditor} />
        {!value.trim() && (
          <p className="pointer-events-none absolute left-3 top-3 text-base leading-8 text-muted-foreground">
            {placeholder}
          </p>
        )}
      </div>

    </div>
  );
});

export default InlineMarkdownEditor;
