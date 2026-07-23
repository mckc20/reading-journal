import { useEffect, useMemo, useState } from "react";
import LinkExtension from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading, Italic, Link, List, ListOrdered, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineMarkdownEditorProps {
  id?: string;
  value: string;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

type SlashCommand = {
  label: string;
  Icon: typeof Heading;
  run: () => void;
};

function editorMarkdown(editor: NonNullable<ReturnType<typeof useEditor>>): string {
  const maybeMarkdownEditor = editor as typeof editor & { getMarkdown?: () => string };
  return maybeMarkdownEditor.getMarkdown?.() ?? editor.getText();
}

export default function InlineMarkdownEditor({
  id,
  value,
  placeholder = "Start writing...",
  minHeightClassName = "min-h-32",
  className,
  autoFocus = false,
  onChange,
  onBlur,
}: InlineMarkdownEditorProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
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

      const { from } = currentEditor.state.selection;
      const previousCharacter = currentEditor.state.doc.textBetween(Math.max(0, from - 1), from);
      setSlashMenuOpen(previousCharacter === "/");
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from } = currentEditor.state.selection;
      const previousCharacter = currentEditor.state.doc.textBetween(Math.max(0, from - 1), from);
      setSlashMenuOpen(previousCharacter === "/");
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editorMarkdown(editor) === value) return;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !autoFocus) return;
    window.requestAnimationFrame(() => editor.commands.focus("end"));
  }, [autoFocus, editor]);

  if (!editor) return null;
  const activeEditor = editor;

  function removeSlashTrigger() {
    const { from } = activeEditor.state.selection;
    const previousCharacter = activeEditor.state.doc.textBetween(Math.max(0, from - 1), from);
    if (previousCharacter === "/") {
      activeEditor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
    } else {
      activeEditor.chain().focus().run();
    }
    setSlashMenuOpen(false);
  }

  function applyLink() {
    const existing = activeEditor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", existing ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      activeEditor.chain().focus().unsetLink().run();
      return;
    }
    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const slashCommands: SlashCommand[] = [
    {
      label: "Heading",
      Icon: Heading,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleHeading({ level: 1 }).run();
      },
    },
    {
      label: "Bold",
      Icon: Bold,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleBold().run();
      },
    },
    {
      label: "Italic",
      Icon: Italic,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleItalic().run();
      },
    },
    {
      label: "Quote",
      Icon: Quote,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      label: "Bullet list",
      Icon: List,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleBulletList().run();
      },
    },
    {
      label: "Numbered list",
      Icon: ListOrdered,
      run: () => {
        removeSlashTrigger();
        activeEditor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      label: "Link",
      Icon: Link,
      run: () => {
        removeSlashTrigger();
        applyLink();
      },
    },
  ];

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={activeEditor} />
      {!value.trim() && (
        <p className="pointer-events-none absolute left-0 top-0 text-base leading-8 text-muted-foreground">
          {placeholder}
        </p>
      )}

      <BubbleMenu
        editor={activeEditor}
        className="flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]"
        shouldShow={({ editor: currentEditor }: { editor: typeof activeEditor }) => !currentEditor.state.selection.empty}
      >
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" onClick={() => activeEditor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" onClick={() => activeEditor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Quote" onClick={() => activeEditor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" onClick={applyLink}>
          <Link className="h-4 w-4" />
        </Button>
      </BubbleMenu>

      {slashMenuOpen && (
        <div className="absolute left-0 top-9 z-30 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]">
          {slashCommands.map(({ Icon, label, run }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
