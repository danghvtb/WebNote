// ============================================================
// MyNotes — Tiptap Rich Text Editor
// Core editor with autosave, formatting, and code highlighting.
// ============================================================

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { Slice, Node as PMNode } from '@tiptap/pm/model';
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
import { Clock, FileText, Link2, Sparkles, AlertTriangle } from 'lucide-react';

import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';
import { EditorToolbar } from './EditorToolbar';
import { SlashMenu } from './SlashMenu';
import { AIModal } from '../modal/AIModal';
import { CustomTaskItemComponent } from './CustomTaskItem';
import { countWords, getReadingTime, extractWikiLinks } from '../../utils';
import { getPageOverdueCount } from '../../utils/taskUtils';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

/**
 * Custom clipboard text serializer to prevent extra blank lines (\n\n)
 * when pasting into plain text apps (like Notepad) and preserve tab indentations (\t).
 */
function serializeSliceToPlainText(slice: Slice): string {
  const blocks: string[] = [];
  slice.content.forEach((node: PMNode) => {
    blocks.push(serializeNodeToPlainText(node, 0));
  });
  return blocks.join('\n');
}

function serializeNodeToPlainText(node: PMNode, depth = 0): string {
  if (node.isText) {
    return node.text || '';
  }

  const nodeType = node.type.name;

  if (nodeType === 'hardBreak') {
    return '\n';
  }

  if (nodeType === 'bulletList' || nodeType === 'orderedList' || nodeType === 'taskList') {
    const items: string[] = [];
    node.forEach((child: PMNode) => {
      items.push(serializeNodeToPlainText(child, depth));
    });
    return items.join('\n');
  }

  if (nodeType === 'listItem' || nodeType === 'taskItem') {
    const indent = '\t'.repeat(depth);
    let prefix = '';
    if (nodeType === 'taskItem') {
      prefix = node.attrs?.checked ? '[x] ' : '[ ] ';
    }

    const childLines: string[] = [];
    node.forEach((child: PMNode) => {
      if (child.type.name === 'bulletList' || child.type.name === 'orderedList' || child.type.name === 'taskList') {
        childLines.push(serializeNodeToPlainText(child, depth + 1));
      } else {
        childLines.push(serializeNodeToPlainText(child, depth));
      }
    });

    const bodyText = childLines.join('\n');
    return bodyText
      .split('\n')
      .map((line, idx) => {
        if (line.length === 0) return '';
        if (idx === 0) return `${indent}${prefix}${line}`;
        return `${indent}${line}`;
      })
      .join('\n');
  }

  if (node.isBlock) {
    const parts: string[] = [];
    node.forEach((child: PMNode) => {
      parts.push(serializeNodeToPlainText(child, depth));
    });
    return parts.join('');
  }

  const parts: string[] = [];
  node.forEach((child: PMNode) => {
    parts.push(serializeNodeToPlainText(child, depth));
  });
  return parts.join('');
}

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
      TaskItem.configure({ nested: true }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            due: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-due'),
              renderHTML: (attributes) => {
                if (!attributes.due) return {};
                return { 'data-due': attributes.due };
              },
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(CustomTaskItemComponent);
        },
      }),
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
      clipboardTextSerializer: (slice) => {
        return serializeSliceToPlainText(slice);
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          setSlashMenuOpen(true);
        }
        if (event.key === 'Tab') {
          event.preventDefault();

          if (event.shiftKey) {
            if (editor?.can().liftListItem('taskItem')) {
              editor.chain().focus().liftListItem('taskItem').run();
              return true;
            }
            if (editor?.can().liftListItem('listItem')) {
              editor.chain().focus().liftListItem('listItem').run();
              return true;
            }

            const { state, dispatch } = view;
            const { selection } = state;
            const { $from } = selection;
            const lineStart = $from.start();
            const lineText = state.doc.textBetween(lineStart, $from.pos);

            if (lineText.startsWith('\t')) {
              dispatch(state.tr.delete(lineStart, lineStart + 1));
              return true;
            } else if (lineText.startsWith('    ')) {
              dispatch(state.tr.delete(lineStart, lineStart + 4));
              return true;
            }
            return true;
          } else {
            if (editor?.can().sinkListItem('taskItem')) {
              editor.chain().focus().sinkListItem('taskItem').run();
              return true;
            }
            if (editor?.can().sinkListItem('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run();
              return true;
            }

            editor?.chain().focus().insertContent('\t').run();
            return true;
          }
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
          {/* Overdue Task Red Alert Banner */}
          {getPageOverdueCount(selectedPage) > 0 && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-100 flex items-center justify-between shadow-[0_0_20px_rgba(244,63,94,0.35)] animate-pulse">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>⚠️ CẢNH BÁO DEADLINE: Ghi chú này có {getPageOverdueCount(selectedPage)} công việc đã quá hạn!</span>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-md bg-rose-900 border border-rose-400 text-rose-200 font-bold tracking-wide">
                🔴 QUÁ HẠN (OVERDUE)
              </span>
            </div>
          )}

          {/* Page Title */}
          <PageTitleInput
            key={selectedPage.id}
            pageId={selectedPage.id}
            initialTitle={selectedPage.title}
            onUpdateTitle={(id, title) => {
              updatePageTitle(id, title);
              queueSync('update', 'page', id);
            }}
            onEnterKey={() => editor?.commands.focus('start')}
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

/**
 * Isolated, Uncontrolled Native Input for Page Title.
 * Prevents React state re-renders from interrupting Vietnamese Unikey IME Composition events.
 */
const PageTitleInput = memo(function PageTitleInput({
  pageId,
  initialTitle,
  onUpdateTitle,
  onEnterKey,
}: {
  pageId: string;
  initialTitle: string;
  onUpdateTitle: (id: string, title: string) => void;
  onEnterKey: () => void;
}) {
  const inputRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const currentTitleRef = useRef(initialTitle);
  const currentPageIdRef = useRef(pageId);

  // Sync value ONLY on initial mount or when pageId changes (switching pages)
  useEffect(() => {
    currentPageIdRef.current = pageId;
    currentTitleRef.current = initialTitle;
    if (inputRef.current) {
      inputRef.current.innerText = initialTitle;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const commitTitle = () => {
    if (!inputRef.current) return;
    const val = inputRef.current.innerText.trim();
    if (val !== currentTitleRef.current) {
      currentTitleRef.current = val;
      onUpdateTitle(pageId, val);
    }
  };

  const handleInput = () => {
    // Keep local ref updated without triggering external re-renders during typing
    if (inputRef.current) {
      currentTitleRef.current = inputRef.current.innerText.trim();
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    commitTitle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isComposingRef.current) {
      e.preventDefault();
      commitTitle();
      onEnterKey();
    }
  };

  return (
    <div
      ref={inputRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={commitTitle}
      onKeyDown={handleKeyDown}
      data-placeholder="Untitled Page"
      className="w-full text-3xl font-extrabold bg-transparent border-none outline-none mb-6 tracking-tight empty:before:content-[attr(data-placeholder)] empty:before:opacity-40"
      style={{ color: 'var(--color-text-primary)' }}
      aria-label="Page title"
    />
  );
});
