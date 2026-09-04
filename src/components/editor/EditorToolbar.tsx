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
  Undo2, Redo2, Sparkles,
} from 'lucide-react';
import { useCallback, useState } from 'react';

interface ToolbarProps {
  editor: Editor;
  onOpenAI?: () => void;
  onToggleSlashMenu?: () => void;
}

interface ToolbarButton {
  icon: React.ReactNode;
  title: string;
  action: () => void;
  isActive?: () => boolean;
}

export function EditorToolbar({ editor, onOpenAI, onToggleSlashMenu }: ToolbarProps) {
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
      { icon: <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />, title: 'AI Assistant (Summarize, Polish, Tasks)', action: () => onOpenAI?.() },
      { icon: <span className="text-xs font-extrabold px-1 text-purple-400">/</span>, title: 'Slash Command Menu (Type /)', action: () => onToggleSlashMenu?.() },
    ],
    // Text formatting
    [
      { icon: <Bold className="w-4 h-4" />, title: 'Bold (Ctrl+B)', action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive('bold') },
      { icon: <Italic className="w-4 h-4" />, title: 'Italic (Ctrl+I)', action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive('italic') },
      { icon: <Underline className="w-4 h-4" />, title: 'Underline (Ctrl+U)', action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive('underline') },
      { icon: <Strikethrough className="w-4 h-4" />, title: 'Strikethrough', action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive('strike') },
    ],
    // Headings
    [
      { icon: <Heading1 className="w-4 h-4" />, title: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive('heading', { level: 1 }) },
      { icon: <Heading2 className="w-4 h-4" />, title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive('heading', { level: 2 }) },
      { icon: <Heading3 className="w-4 h-4" />, title: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive('heading', { level: 3 }) },
    ],
    // Lists
    [
      { icon: <List className="w-4 h-4" />, title: 'Bullet List', action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive('bulletList') },
      { icon: <ListOrdered className="w-4 h-4" />, title: 'Numbered List', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive('orderedList') },
      { icon: <CheckSquare className="w-4 h-4" />, title: 'Checklist', action: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive('taskList') },
    ],
    // Blocks
    [
      { icon: <Quote className="w-4 h-4" />, title: 'Quote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive('blockquote') },
      { icon: <Code className="w-4 h-4" />, title: 'Inline Code', action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive('code') },
      { icon: <Code2 className="w-4 h-4" />, title: 'Code Block', action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive('codeBlock') },
    ],
    // Insert
    [
      { icon: <Table className="w-4 h-4" />, title: 'Insert Table', action: handleInsertTable },
      { icon: <Minus className="w-4 h-4" />, title: 'Horizontal Line', action: () => editor.chain().focus().setHorizontalRule().run() },
      { icon: <Link className="w-4 h-4" />, title: 'Insert Link', action: () => setShowLinkInput(!showLinkInput), isActive: () => editor.isActive('link') },
      { icon: <Image className="w-4 h-4" />, title: 'Insert Image', action: handleAddImage },
    ],
    // History
    [
      { icon: <Undo2 className="w-4 h-4" />, title: 'Undo (Ctrl+Z)', action: () => editor.chain().focus().undo().run() },
      { icon: <Redo2 className="w-4 h-4" />, title: 'Redo (Ctrl+Shift+Z)', action: () => editor.chain().focus().redo().run() },
    ],
  ];

  return (
    <div
      className="flex-shrink-0 px-4 py-1.5 flex items-center flex-wrap gap-0.5 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}
    >
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-0.5">
          {group.map((button, i) => {
            const active = button.isActive?.();
            return (
              <button
                key={i}
                onClick={button.action}
                title={button.title}
                aria-label={button.title}
                className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                style={{
                  color: active ? '#ffffff' : 'var(--color-text-primary)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  boxShadow: active ? '0 0 8px rgba(88, 166, 255, 0.4)' : 'none',
                }}
                onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
              >
                {button.icon}
              </button>
            );
          })}
          {groupIndex < groups.length - 1 && (
            <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
          )}
        </div>
      ))}

      {/* Link Input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 ml-2 animate-slide-up">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
            placeholder="Enter URL..."
            autoFocus
            className="px-2 py-1 text-xs rounded-md bg-transparent outline-none w-48"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={handleAddLink}
            className="px-2 py-1 text-xs rounded-md cursor-pointer"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
