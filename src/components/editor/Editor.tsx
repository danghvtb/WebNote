// ============================================================
// MyNotes — Tiptap Rich Text Editor
// Core editor with autosave, formatting, and code highlighting.
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { common, createLowlight } from 'lowlight';
import { Clock, FileText, Link2, Sparkles } from 'lucide-react';

import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';
import { EditorToolbar } from './EditorToolbar';
import { SlashMenu } from './SlashMenu';
import { AIModal } from '../modal/AIModal';
import { countWords, getReadingTime, extractWikiLinks } from '../../utils';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

export function Editor() {
  const { selectedPageId, pages, updatePageContent, updatePageTitle, selectPage, deletePage } = useNotesStore();
  const { setSyncStatus, setConfirmModal, addNotification } = useAppStore();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageRef = useRef<string | null>(null);

  const handleDeleteCurrentPage = () => {
    if (!selectedPageId) return;
    const pageToDelete = pages.find((p) => p.id === selectedPageId);

    setConfirmModal({
      open: true,
      title: 'Xóa ghi chú (Delete Page)',
      message: `Bạn có chắc chắn muốn xóa ghi chú "${pageToDelete?.title || 'Untitled'}" không?`,
      onConfirm: async () => {
        await deletePage(selectedPageId);
        await queueSync('delete', 'page', selectedPageId);
        addNotification('success', 'Đã xóa ghi chú!');
      },
    });
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Debounced save handler
  const handleSave = useCallback(
    (html: string) => {
      if (!selectedPageId) return;

      setSyncStatus('saving');

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        try {
          await updatePageContent(selectedPageId, html);
          await queueSync('update', 'page', selectedPageId, { content: html });
        } catch (err) {
          console.error('[Editor] Save failed:', err);
          setSyncStatus('error', 'Save failed');
        }
      }, 1500); // 1.5 second debounce
    },
    [selectedPageId, updatePageContent, setSyncStatus]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockLowlight instead
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        HTMLAttributes: { class: 'editor-image' },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
      handleKeyDown: (_, event) => {
        if (event.key === '/') {
          setSlashMenuOpen(true);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      handleSave(editor.getHTML());
    },
  });

  // Update editor content when page changes
  useEffect(() => {
    if (!editor || !selectedPage) return;

    // Only update if switching to a different page
    if (currentPageRef.current !== selectedPageId) {
      currentPageRef.current = selectedPageId || null;
      const currentContent = editor.getHTML();
      if (currentContent !== selectedPage.content) {
        editor.commands.setContent(selectedPage.content || '', { emitUpdate: false });
      }
    }
  }, [editor, selectedPage, selectedPageId]);

  // Handle title editing
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPageId) return;
    updatePageTitle(selectedPageId, e.target.value);
    queueSync('update', 'page', selectedPageId);
  };

  // Handle title Enter key → focus editor
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };

  if (!selectedPage) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="text-center">
          <p className="text-base mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Select a page to start editing</p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Or create a new one from the sidebar</p>
        </div>
      </div>
    );
  }

  // Word & Reading statistics
  const wordCount = countWords(selectedPage.content);
  const readingTime = getReadingTime(selectedPage.content);

  // Find pages referencing current page
  const backlinks = pages.filter(
    (p) => p.id !== selectedPage.id && (p.content.includes(selectedPage.title) || extractWikiLinks(p.content).includes(selectedPage.title))
  );

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Toolbar */}
      {editor && (
        <EditorToolbar
          editor={editor}
          onOpenAI={() => setAiModalOpen(true)}
          onToggleSlashMenu={() => setSlashMenuOpen((prev) => !prev)}
          onDeletePage={handleDeleteCurrentPage}
        />
      )}

      {/* Slash Commands Dropdown Menu */}
      {editor && (
        <SlashMenu
          editor={editor}
          isOpen={slashMenuOpen}
          onClose={() => setSlashMenuOpen(false)}
          onOpenAI={() => setAiModalOpen(true)}
        />
      )}

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-16 py-6 max-w-4xl mx-auto w-full flex flex-col justify-between">
        <div>
          {/* Page Title */}
          <input
            type="text"
            value={selectedPage.title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled Page"
            className="w-full text-3xl font-extrabold bg-transparent border-none outline-none mb-6 tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
            aria-label="Page title"
          />

          {/* Tiptap Editor */}
          <EditorContent editor={editor} />
        </div>

        {/* Footer: Word Stats & Backlinks */}
        <div className="mt-12 pt-6 border-t border-slate-800 text-xs text-slate-400 space-y-4">
          {/* Linked References / Backlinks */}
          {backlinks.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5 text-xs">
                <Link2 className="w-3.5 h-3.5 text-purple-400" />
                Linked References ({backlinks.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {backlinks.map((bl) => (
                  <button
                    key={bl.id}
                    onClick={() => selectPage(bl.id)}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/20 border border-purple-500/30 text-purple-300 hover:bg-purple-900/40 transition-all cursor-pointer"
                  >
                    {bl.title || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Word Metrics */}
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {wordCount} words
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {readingTime} min read
              </span>
            </div>
            <button
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              AI Copilot
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <AIModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </div>
  );
}
