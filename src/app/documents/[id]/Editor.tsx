"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";

const PLACEHOLDER = "Start writing…";

export type EditorHandle = {
  getHtml: () => string;
};

export default function TiptapEditor({
  initialHtml,
  editable,
  onChange,
  onReady,
}: {
  initialHtml: string;
  editable: boolean;
  onChange?: (html: string) => void;
  onReady?: (editor: Editor) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // Ensure lists are enabled (they are by default in the starter kit).
        }),
        Underline,
      ],
      content: initialHtml || "<p></p>",
      editorProps: {
        attributes: {
          class:
            "prose max-w-none min-h-[24rem] focus:outline-none",
          "data-placeholder": PLACEHOLDER,
        },
      },
      onUpdate({ editor }) {
        onChangeRef.current?.(editor.getHTML());
      },
    },
    []
  );

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (editor && onReadyRef.current) onReadyRef.current(editor);
  }, [editor]);

  return (
    <div>
      {editor ? <Toolbar editor={editor} disabled={!editable} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const items = [
    { label: "B", title: "Bold (⌘B)", active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
      className: "font-bold" },
    { label: "I", title: "Italic (⌘I)", active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
      className: "italic" },
    { label: "U", title: "Underline (⌘U)", active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
      className: "underline" },
    { label: "H1", title: "Heading 1", active: editor.isActive("heading", { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Heading 2", active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "Heading 3", active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "P",  title: "Paragraph", active: editor.isActive("paragraph"),
      run: () => editor.chain().focus().setParagraph().run() },
    { label: "•", title: "Bulleted list", active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1.", title: "Numbered list", active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div
      className={
        "sticky top-[3.75rem] z-20 -mx-4 sm:mx-0 flex flex-wrap items-center gap-1 " +
        "border-b border-neutral-200 bg-white/90 backdrop-blur px-2 py-1.5 sm:rounded-lg sm:border sm:shadow-sm"
      }
      role="toolbar"
      aria-label="Formatting"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.run}
          disabled={disabled}
          title={item.title}
          aria-pressed={item.active}
          className={
            "min-w-8 h-8 px-2 rounded text-sm transition " +
            (disabled
              ? "text-neutral-400 cursor-not-allowed"
              : item.active
              ? "bg-neutral-900 text-white"
              : "text-neutral-700 hover:bg-neutral-100") +
            (item.className ? " " + item.className : "")
          }
        >
          {item.label}
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
      <button
        type="button"
        title="Undo (⌘Z)"
        disabled={disabled || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        className="min-w-8 h-8 px-2 rounded text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ↺
      </button>
      <button
        type="button"
        title="Redo (⌘⇧Z)"
        disabled={disabled || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        className="min-w-8 h-8 px-2 rounded text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ↻
      </button>
    </div>
  );
}
