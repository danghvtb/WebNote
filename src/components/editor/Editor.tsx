// ============================================================
// MyNotes — Tiptap Rich Text Editor
// Core editor with autosave, formatting, and code highlighting.
// ============================================================

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/core';
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
import { Clock, FileText, Link2, Sparkles, AlertTriangle, Paperclip, Trash2, BookOpen, Share2, RotateCcw } from 'lucide-react';

import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { processGoogleSyncQueue, queueSync } from '../../services/sync/syncManager';
import { recoverPageSnapshot } from '../../services/sync/pageRecovery';
import { addPageAttachment, createRevision, deletePageAttachment, getPageAttachments, getPageRevisions, prunePageRevisions, restoreRevision } from '../../services/database/repository';
import { downloadFileAsBlob, uploadBinaryFile } from '../../services/google/drive';
import type { Attachment, Page, Revision } from '../../types';
import { EditorToolbar } from './EditorToolbar';
import { SlashMenu } from './SlashMenu';
import { AIModal } from '../modal/AIModal';
import { CustomTaskItemComponent } from './CustomTaskItem';
import { AutoTranslateBlock } from './AutoTranslateBlock';
import { countWords, getReadingTime, extractWikiLinks, normalizeComparableText } from '../../utils';
import { getPageOverdueCount } from '../../utils/taskUtils';
import { PageTagPicker } from './PageTagPicker';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

/**
 * Custom clipboard text serializer to prevent extra blank lines (\n\n)
 * when pasting into plain text apps (like Notepad) and preserve tab indentations (\t).
 */
function serializeSliceToPlainText(slice: Slice): string {
  const blocks: string[] = [];
  slice.content.forEach((node: PMNode) => {
    const text = serializeNodeToPlainText(node, 0).trimEnd();
    if (text) {
      blocks.push(text);
    }
  });
  // Collapse any 3+ consecutive newlines down to \n\n (max 1 empty line between blocks)
  const rawText = blocks.join('\n');
  return rawText.replace(/\n{3,}/g, '\n\n').trim();
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
    let listIdx = 1;
    node.forEach((child: PMNode) => {
      const itemText = serializeListItemNode(child, depth, nodeType, listIdx).trim();
      if (itemText) {
        items.push(itemText);
        listIdx++;
      }
    });
    return items.join('\n');
  }

  if (nodeType === 'listItem' || nodeType === 'taskItem') {
    return serializeListItemNode(node, depth, 'bulletList', 1);
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

function serializeListItemNode(node: PMNode, depth: number, parentType: string, index: number): string {
  const indent = '\t'.repeat(depth);
  let prefix = '';

  if (parentType === 'taskList' || node.type.name === 'taskItem') {
    prefix = node.attrs?.checked ? '[x] ' : '[ ] ';
  } else if (parentType === 'orderedList') {
    prefix = `${index}. `;
  } else {
    prefix = '• ';
  }

  const childParts: string[] = [];
  node.forEach((child: PMNode) => {
    if (child.type.name === 'bulletList' || child.type.name === 'orderedList' || child.type.name === 'taskList') {
      childParts.push(serializeNodeToPlainText(child, depth + 1));
    } else {
      childParts.push(serializeNodeToPlainText(child, depth));
    }
  });

  const bodyText = childParts.join('\n').trim();
  if (!bodyText) return '';

  return bodyText
    .split('\n')
    .map((line, idx) => {
      if (line.length === 0) return '';
      if (idx === 0) return `${indent}${prefix}${line}`;
      return `${indent}${line}`;
    })
    .join('\n');
}

export function Editor() {
  const { selectedPageId, pages, updatePageContent, updatePageTitle, selectPage, deletePage, restorePage } = useNotesStore();
  const { setSyncStatus, setConfirmModal, addNotification, rootFolderId } = useAppStore();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [translateBlockOpen, setTranslateBlockOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [headings, setHeadings] = useState<Array<{ level: number; text: string; pos: number }>>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const [recoveringFromDrive, setRecoveringFromDrive] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  // Autosave timers must be isolated per page. A single shared timer lets a
  // second page cancel the first page's pending save during quick navigation.
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const currentPageRef = useRef<string | null>(null);
  const lastRevisionAtRef = useRef(0);
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  useEffect(() => {
    if (!historyOpen || !selectedPageId) return;
    getPageRevisions(selectedPageId).then(setRevisions).catch(() => setRevisions([]));
  }, [historyOpen, selectedPageId]);

  useEffect(() => {
    if (!selectedPageId) { setAttachments([]); return; }
    getPageAttachments(selectedPageId).then(setAttachments).catch(() => setAttachments([]));
  }, [selectedPageId]);

  const handleAttachmentUpload = async (file: File) => {
    if (!selectedPageId || file.size > 10 * 1024 * 1024) {
      addNotification('warning', 'Tệp đính kèm tối đa 10 MB.');
      return;
    }
    setUploadingAttachment(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Không thể đọc tệp'));
        reader.readAsDataURL(file);
      });
      let driveFileId: string | undefined;
      if (rootFolderId && navigator.onLine) {
        try { driveFileId = (await uploadBinaryFile(file.name, file, rootFolderId)).id; } catch { addNotification('info', 'Đã lưu tệp cục bộ; sẽ đồng bộ Drive khi kết nối lại.'); }
      }
      const attachment = await addPageAttachment({ pageId: selectedPageId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataUrl, driveFileId });
      setAttachments((current) => [...current, attachment]);
      await queueSync('create', 'attachment', attachment.id, attachment);
      addNotification('success', `Đã đính kèm “${file.name}”`);
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể đính kèm tệp.');
    } finally { setUploadingAttachment(false); }
  };

  const handleAttachmentDelete = async (attachment: Attachment) => {
    await deletePageAttachment(attachment.id);
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    // Keep the Drive file id in the queue after the local soft-delete so the
    // background worker can remove the remote binary as well.
    await queueSync('delete', 'attachment', attachment.id, attachment);
  };

  const handleAttachmentRetry = async () => {
    await processGoogleSyncQueue();
    if (selectedPageId) setAttachments(await getPageAttachments(selectedPageId));
  };

  const openDriveAttachment = async (attachment: Attachment) => {
    if (!attachment.driveFileId) return;
    try {
      const blob = await downloadFileAsBlob(attachment.driveFileId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      addNotification('warning', 'Không thể tải tệp từ Google Drive lúc này.');
    }
  };

  const shareAttachment = async (attachment: Attachment) => {
    try {
      if (navigator.share && attachment.dataUrl) {
        const response = await fetch(attachment.dataUrl);
        const file = new File([await response.blob()], attachment.name, { type: attachment.mimeType });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: attachment.name }); return; }
      }
      await navigator.clipboard.writeText(attachment.dataUrl || attachment.driveFileId || attachment.name);
      addNotification('info', 'Đã sao chép liên kết tệp.');
    } catch { addNotification('warning', 'Không thể chia sẻ tệp trên thiết bị này.'); }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    setRestoringRevisionId(revisionId);
    try {
      const restored = await restoreRevision(revisionId);
      if (restored) {
        await updatePageContent(restored.id, restored.content);
        await updatePageTitle(restored.id, restored.title);
        await queueSync('update', 'page', restored.id);
        addNotification('success', 'Đã khôi phục phiên bản ghi chú.');
        setHistoryOpen(false);
      }
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể khôi phục phiên bản.');
    } finally {
      setRestoringRevisionId(null);
    }
  };

  const handleRecoverFromDrive = async () => {
    if (!selectedPageId) return;
    setRecoveringFromDrive(true);
    try {
      const recovered = await recoverPageSnapshot(selectedPageId);
      if (!recovered) {
        addNotification('warning', 'Không tìm thấy bản sao page có nội dung trên Google Drive.');
        return;
      }

      // Preserve the current state before replacing it with the recovered copy.
      await createRevision(selectedPageId);
      await updatePageContent(selectedPageId, recovered.content);
      await updatePageTitle(selectedPageId, recovered.title);
      await queueSync('update', 'page', selectedPageId, { content: recovered.content, title: recovered.title });
      editor?.commands.setContent(recovered.content, { emitUpdate: false });
      if (editor) refreshHeadings(editor);
      addNotification('success', 'Đã khôi phục bản sao gần nhất từ Google Drive.');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể khôi phục từ Google Drive.');
    } finally {
      setRecoveringFromDrive(false);
    }
  };

  const handleDeleteCurrentPage = () => {
    if (!selectedPageId) return;
    const pageIdToDelete = selectedPageId;
    const pageToDelete = pages.find((p) => p.id === pageIdToDelete);
    const pageTitle = pageToDelete?.title || 'Chưa có tiêu đề';

    setConfirmModal({
      open: true,
      title: 'Chuyển vào thùng rác (Move to Trash)',
      message: `Bạn có chắc chắn muốn chuyển ghi chú "${pageTitle}" vào Thùng rác không?`,
      onConfirm: async () => {
        // 1. Immediately cancel any pending autosave to prevent "Zombie Page"
        const pendingSave = saveTimersRef.current.get(pageIdToDelete);
        if (pendingSave) {
          clearTimeout(pendingSave);
          saveTimersRef.current.delete(pageIdToDelete);
        }

        // 2. Preserve attachment metadata in the queue while the page is moved
        // to Trash so Drive binaries are removed/reconciled as well.
        const pageAttachments = await getPageAttachments(pageIdToDelete, true);
        await deletePage(pageIdToDelete);
        await queueSync('delete', 'page', pageIdToDelete);
        await Promise.all(pageAttachments.map((attachment) => queueSync('delete', 'attachment', attachment.id, attachment)));

        // 3. Show Toast with Undo action button
        addNotification(
          'info',
          `Đã chuyển "${pageTitle}" vào Thùng rác`,
          {
            label: 'Hoàn tác',
            onClick: async () => {
              await restorePage(pageIdToDelete);
              await queueSync('update', 'page', pageIdToDelete);
              await Promise.all(pageAttachments.map((attachment) => queueSync('update', 'attachment', attachment.id)));
              addNotification('success', `Đã khôi phục "${pageTitle}"`);
            },
          },
          7000
        );
      },
    });
  };

  // Debounced save handler
  const handleSave = useCallback(
    (html: string) => {
      if (!selectedPageId) return;

      setSyncStatus('saving');

      const previousTimer = saveTimersRef.current.get(selectedPageId);
      if (previousTimer) clearTimeout(previousTimer);

      const timer = setTimeout(async () => {
        saveTimersRef.current.delete(selectedPageId);
        try {
          // Keep a lightweight recovery point at most once per 15 minutes.
          if (Date.now() - lastRevisionAtRef.current > 15 * 60 * 1000) {
            await createRevision(selectedPageId);
            await prunePageRevisions(selectedPageId);
            lastRevisionAtRef.current = Date.now();
          }
          await updatePageContent(selectedPageId, html);
          await queueSync('update', 'page', selectedPageId, { content: html });
        } catch (err) {
          console.error('[Editor] Save failed:', err);
          setSyncStatus('error', 'Không thể lưu thay đổi');
        }
      }, 1500); // 1.5 second debounce
      saveTimersRef.current.set(selectedPageId, timer);
    },
    [selectedPageId, updatePageContent, setSyncStatus]
  );

  const refreshHeadings = useCallback((instance: TiptapEditor | null) => {
    if (!instance) return;
    const next: Array<{ level: number; text: string; pos: number }> = [];
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        next.push({ level: Number(node.attrs.level) || 1, text: node.textContent.trim(), pos });
      }
    });
    setHeadings(next);
  }, []);

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
        placeholder: 'Bắt đầu viết...',
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
      refreshHeadings(editor);
      handleSave(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) refreshHeadings(editor);
  }, [editor, selectedPageId, refreshHeadings]);

  useEffect(() => {
    editor?.setEditable(!readingMode);
  }, [editor, readingMode]);

  const handleInsertTranslation = useCallback(
    (text: string) => {
      if (!editor) return;
      const formatted = text
        .split('\n')
        .map((l) => `<p>${l}</p>`)
        .join('');
      editor.chain().focus('end').insertContent(formatted).run();
    },
    [editor]
  );

  const handleReplaceNote = useCallback(
    (text: string) => {
      if (!editor) return;
      const formatted = text
        .split('\n')
        .map((l) => `<p>${l}</p>`)
        .join('');
      editor.commands.setContent(formatted);
    },
    [editor]
  );

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
          <p className="text-base mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Chọn một trang để bắt đầu chỉnh sửa</p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Hoặc tạo trang mới từ thanh bên</p>
        </div>
      </div>
    );
  }

  // Word & Reading statistics
  const wordCount = countWords(selectedPage.content);
  const readingTime = getReadingTime(selectedPage.content);

  // Resolve both explicit [[Wiki links]] and plain title mentions using the
  // same accent/case-insensitive rule as global search. This keeps backlinks
  // useful when a title is typed without Vietnamese diacritics.
  const targetTitle = normalizeComparableText(selectedPage.title || '');
  const backlinks = pages.filter((p) => {
    if (p.id === selectedPage.id) return false;
    const linkedTitles = extractWikiLinks(p.content || '').map(normalizeComparableText);
    return Boolean(targetTitle) && (linkedTitles.includes(targetTitle) || normalizeComparableText(p.content || '').includes(targetTitle));
  });
  const outgoingLinks = Array.from(new Set(extractWikiLinks(selectedPage.content || '').map(normalizeComparableText)))
    .map((title) => pages.find((page) => normalizeComparableText(page.title || '') === title))
    .filter((page): page is NonNullable<typeof page> => Boolean(page && page.id !== selectedPage.id));
  const backlinkSuggestions = (() => {
    if (!targetTitle) return [];
    const body = normalizeComparableText(selectedPage.content || '');
    const linkedIds = new Set([...backlinks, ...outgoingLinks].map((page) => page.id));
    return pages
      .filter((page) => page.id !== selectedPage.id && !linkedIds.has(page.id) && !page.deletedAt)
      .map((page) => {
        const words = normalizeComparableText(page.title || '').split(' ').filter((word) => word.length > 2);
        const score = words.reduce((total, word) => total + (body.includes(word) ? 1 : 0), 0);
        return { page, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.page);
  })();
  const insertWikiLink = (page: Page) => {
    if (!editor) return;
    editor.chain().focus().insertContent(` [[${page.title || 'Chưa có tiêu đề'}]]`).run();
    addNotification('success', `Đã thêm liên kết tới “${page.title || 'Chưa có tiêu đề'}”.`);
  };

  return (
    <div className="h-full flex flex-col relative" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Toolbar */}
      {editor && !readingMode && (
        <EditorToolbar
          editor={editor}
          onOpenAI={() => setAiModalOpen(true)}
          onToggleSlashMenu={() => setSlashMenuOpen((prev) => !prev)}
          onDeletePage={handleDeleteCurrentPage}
          onToggleTranslate={() => setTranslateBlockOpen((prev) => !prev)}
          isTranslateOpen={translateBlockOpen}
        />
      )}

      {/* Slash Commands Dropdown Menu */}
      {editor && (
        <SlashMenu
          editor={editor}
          isOpen={slashMenuOpen}
          onClose={() => setSlashMenuOpen(false)}
          onOpenAI={() => setAiModalOpen(true)}
          onToggleTranslate={() => setTranslateBlockOpen(true)}
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

          {/* Live Auto-Translate Block */}
          {translateBlockOpen && selectedPage && (
            <AutoTranslateBlock
              noteContent={selectedPage.content || ''}
              onInsertTranslation={handleInsertTranslation}
              onReplaceNote={handleReplaceNote}
              onClose={() => setTranslateBlockOpen(false)}
            />
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

          <PageTagPicker pageId={selectedPage.id} tagIds={selectedPage.tagIds || []} />
          <div className="flex items-center justify-end mb-3"><button type="button" onClick={() => setReadingMode((value) => !value)} className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer" aria-pressed={readingMode}><BookOpen className="w-3.5 h-3.5" /> {readingMode ? 'Thoát chế độ đọc' : 'Chế độ đọc'}</button></div>

          <section className="my-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3" aria-label="Tệp đính kèm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5 text-cyan-300" /> Tệp đính kèm ({attachments.length})</h2>
              <label className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" /> {uploadingAttachment ? 'Đang tải...' : 'Thêm tệp'}
                <input type="file" className="sr-only" disabled={uploadingAttachment} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAttachmentUpload(file); event.currentTarget.value = ''; }} />
              </label>
            </div>
            {attachments.length === 0 ? <p className="text-[11px] text-slate-500">Đính kèm tài liệu tối đa 10 MB; dữ liệu được giữ offline và đồng bộ Drive khi có kết nối.</p> : <div className="flex flex-wrap gap-2">{attachments.map((attachment) => <div key={attachment.id} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 max-w-full">{attachment.mimeType.startsWith('image/') && attachment.dataUrl && <img src={attachment.dataUrl} alt={attachment.name} className="h-8 w-8 rounded object-cover" loading="lazy" />}<a href={attachment.dataUrl} download={attachment.name} className="max-w-[220px] truncate text-xs text-cyan-300 hover:underline" title={attachment.name}>{attachment.name}</a><span className="text-[10px] text-slate-500">{Math.ceil(attachment.size / 1024)} KB</span><span className={`text-[10px] ${attachment.driveFileId ? 'text-emerald-400' : 'text-amber-400'}`}>{attachment.driveFileId ? 'Đã đồng bộ' : 'Chờ Drive'}</span>{!attachment.driveFileId && <button type="button" onClick={() => void handleAttachmentRetry()} className="touch-target p-1 text-amber-300 hover:text-amber-200" aria-label={`Thử đồng bộ tệp ${attachment.name}`} title="Thử đồng bộ lại"><RotateCcw className="w-3 h-3" /></button>}<button type="button" onClick={() => void shareAttachment(attachment)} className="touch-target p-1 text-slate-500 hover:text-cyan-300" aria-label={`Chia sẻ tệp ${attachment.name}`}><Share2 className="w-3 h-3" /></button><button type="button" onClick={() => void handleAttachmentDelete(attachment)} className="touch-target p-1 text-slate-500 hover:text-rose-300" aria-label={`Xóa tệp ${attachment.name}`}><Trash2 className="w-3 h-3" /></button></div>)}</div>}
            {attachments.some((attachment) => !attachment.dataUrl && attachment.driveFileId) && <div className="mt-2 space-y-1"><p className="text-[10px] text-slate-500">Tệp chỉ có trên Drive:</p>{attachments.filter((attachment) => !attachment.dataUrl && attachment.driveFileId).map((attachment) => <button type="button" key={`drive-${attachment.id}`} onClick={() => void openDriveAttachment(attachment)} className="touch-target w-full justify-start rounded-lg border border-slate-700 px-2 text-xs text-cyan-300 hover:bg-slate-800">Mở {attachment.name}</button>)}</div>}
          </section>

          {headings.length > 0 && (
            <details className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40" open>
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-300">Mục lục ({headings.length})</summary>
              <nav aria-label="Mục lục trang" className="px-3 pb-3 space-y-1">
                {headings.map((heading, index) => (
                  <button key={`${heading.pos}-${index}`} type="button" onClick={() => editor?.chain().focus().setTextSelection(heading.pos + 1).run()} className="block w-full text-left text-xs text-slate-400 hover:text-cyan-300 truncate" style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 12}px` }}>{heading.text}</button>
                ))}
              </nav>
            </details>
          )}

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
                Liên kết ngược ({backlinks.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {backlinks.map((bl) => (
                  <button
                    key={bl.id}
                    onClick={() => selectPage(bl.id)}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/20 border border-purple-500/30 text-purple-300 hover:bg-purple-900/40 transition-all cursor-pointer"
                  >
                    {bl.title || 'Chưa có tiêu đề'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {outgoingLinks.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5 text-xs">
                <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                Liên kết tới ({outgoingLinks.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {outgoingLinks.map((linkedPage) => (
                  <button
                    key={linkedPage.id}
                    type="button"
                    onClick={() => selectPage(linkedPage.id)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-900/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 transition-all cursor-pointer"
                  >
                    {linkedPage.title || 'Chưa có tiêu đề'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {backlinkSuggestions.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20">
              <h4 className="font-semibold text-amber-200 mb-1 flex items-center gap-1.5 text-xs">Gợi ý liên kết ({backlinkSuggestions.length})</h4>
              <p className="text-[11px] text-amber-100/60 mb-2">Các trang có từ khóa trùng với nội dung hiện tại.</p>
              <div className="flex flex-wrap gap-2">
                {backlinkSuggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => insertWikiLink(suggestion)} className="touch-target px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-900/30">+ {suggestion.title || 'Chưa có tiêu đề'}</button>)}
              </div>
            </div>
          )}

          {/* Word Metrics */}
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {wordCount} từ
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {readingTime} phút đọc
              </span>
            </div>
            <button
              onClick={() => setHistoryOpen((open) => !open)}
              className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-expanded={historyOpen}
            >
              Lịch sử ({revisions.length})
            </button>
            <button
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Trợ lý AI
            </button>
          </div>

          {historyOpen && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800" role="region" aria-label="Lịch sử phiên bản">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-300 text-xs">Các phiên bản gần đây</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRecoverFromDrive()}
                    disabled={recoveringFromDrive}
                    className="touch-target px-2 py-1 rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/30 disabled:opacity-50 cursor-pointer"
                  >
                    {recoveringFromDrive ? 'Đang khôi phục...' : 'Khôi phục từ Drive'}
                  </button>
                  <button type="button" onClick={() => setHistoryOpen(false)} className="touch-target px-2 py-1 text-slate-500 hover:text-white text-xs cursor-pointer">Đóng</button>
                </div>
              </div>
              {revisions.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có phiên bản lưu tự động.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {revisions.map((revision) => (
                    <div key={revision.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">{new Date(revision.createdAt).toLocaleString('vi-VN')}</span>
                      <button
                        onClick={() => handleRestoreRevision(revision.id)}
                        disabled={restoringRevisionId !== null}
                        className="px-2 py-1 rounded bg-purple-900/40 text-purple-200 hover:bg-purple-800/60 disabled:opacity-50 cursor-pointer"
                      >
                        {restoringRevisionId === revision.id ? 'Đang khôi phục...' : 'Khôi phục'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
      data-placeholder="Trang chưa có tiêu đề"
      className="w-full text-3xl font-extrabold bg-transparent border-none outline-none mb-6 tracking-tight empty:before:content-[attr(data-placeholder)] empty:before:opacity-40"
      style={{ color: 'var(--color-text-primary)' }}
      aria-label="Page title"
    />
  );
});
