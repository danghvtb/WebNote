// ============================================================
// MyNotes — Editor Toolbar
// Formatting toolbar for the Tiptap editor.
// ============================================================

import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Code2,
  Table, Image, Link, Minus,
  Undo2, Redo2, Sparkles, Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';

interface ToolbarProps {
  editor: Editor;
  onOpenAI?: () => void;
  onToggleSlashMenu?: () => void;
  onDeletePage?: () => void;
}

interface ToolbarButton {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: () => boolean;
}

export function EditorToolbar({ editor, onOpenAI, onToggleSlashMenu, onDeletePage }: ToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleAddLink = useCallback(() => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
    }
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const handleAddImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleInsertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const groups: ToolbarButton[][] = [
    // AI & Slash Assistant
    [
      { icon: <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />, title: 'AI Assistant (Summarize, Polish, Tasks)', action: () => onOpenAI?.() },
      { icon: <span className="text-sm font-extrabold px-1 text-purple-400">/</span>, title: 'Slash Command Menu (Type /)', action: () => onToggleSlashMenu?.() },
    ],
    // Text formatting
    [
      { icon: <Bold className="w-5 h-5" />, title: 'Bold (Ctrl+B)', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
      { icon: <Italic className="w-5 h-5" />, title: 'Italic (Ctrl+I)', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
      { icon: <Underline className="w-5 h-5" />, title: 'Underline (Ctrl+U)', action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline') },
      { icon: <Strikethrough className="w-5 h-5" />, title: 'Strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    ],
    // Headings
    [
      { icon: <Heading1 className="w-5 h-5" />, title: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
      { icon: <Heading2 className="w-5 h-5" />, title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
      { icon: <Heading3 className="w-5 h-5" />, title: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    ],
    // Lists
    [
      { icon: <List className="w-5 h-5" />, title: 'Bullet List', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
      { icon: <ListOrdered className="w-5 h-5" />, title: 'Numbered List', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
      { icon: <CheckSquare className="w-5 h-5" />, title: 'Checklist', action: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive('taskList') },
    ],
    // Blocks
    [
      { icon: <Quote className="w-5 h-5" />, title: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
      { icon: <Code className="w-5 h-5" />, title: 'Inline Code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
      { icon: <Code2 className="w-5 h-5" />, title: 'Code Block', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    ],
    // Insert
    [
      { icon: <Table className="w-5 h-5" />, title: 'Insert Table', action: handleInsertTable },
      { icon: <Minus className="w-5 h-5" />, title: 'Horizontal Line', action: () => editor.chain().focus().setHorizontalRule().run() },
      { icon: <Link className="w-5 h-5" />, title: 'Insert Link', action: () => setShowLinkInput(!showLinkInput), isActive: () => editor.isActive('link') },
      { icon: <Image className="w-5 h-5" />, title: 'Insert Image', action: handleAddImage },
    ],
    // History
    [
      { icon: <Undo2 className="w-5 h-5" />, title: 'Undo (Ctrl+Z)', action: () => editor.chain().focus().undo().run() },
      { icon: <Redo2 className="w-5 h-5" />, title: 'Redo (Ctrl+Shift+Z)', action: () => editor.chain().focus().redo().run() },
    ],
    // Delete Note
    [
      { icon: <Trash2 className="w-5 h-5 text-rose-400 hover:text-rose-300" />, title: 'Xóa bài viết này (Delete Note)', action: () => onDeletePage?.() },
    ],
  ];

  return (
    <div
      className="flex items-center gap-1 p-1.5 overflow-x-auto no-scrollbar max-w-full"
      style={{
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="flex items-center gap-0.5 flex-shrink-0">
          {group.map((button, btnIdx) => {
            const active = button.isActive?.();
            return (
              <button
                key={btnIdx}
                onClick={button.action}
                title={button.title}
                className={`p-1.5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                  active
                    ? 'bg-slate-700 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                style={{
                  background: active ? 'var(--color-bg-tertiary)' : undefined,
                  color: active ? 'var(--color-accent)' : undefined,
                }}
              >
                {button.icon}
              </button>
            );
          })}
          {groupIdx < groups.length - 1 && (
            <div
              className="h-4 w-px mx-1 flex-shrink-0"
              style={{ background: 'var(--color-border)' }}
            />
          )}
        </div>
      ))}

      {/* Link Input Popover */}
      {showLinkInput && (
        <div
          className="absolute top-12 left-4 z-50 flex items-center gap-2 p-2 rounded-lg shadow-xl"
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <input
            type="url"
            placeholder="Paste URL..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
            className="px-2 py-1 text-xs rounded bg-slate-900 text-white outline-none border border-slate-700 w-48 sm:w-64"
            autoFocus
          />
          <button
            onClick={handleAddLink}
            className="px-2.5 py-1 text-xs rounded font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setShowLinkInput(false)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
