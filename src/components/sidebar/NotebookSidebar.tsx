// ============================================================
// MyNotes — Notebook Sidebar
// Middle column: Notebooks for selected day + page list.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Notebook, FileText, ChevronRight, ChevronDown, Pencil, Copy, Trash2 } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { formatDateFull } from '../../utils';
import { queueSync } from '../../services/sync/syncManager';

export function NotebookSidebar() {
  const {
    notebooks, pages, selectedDayId, selectedNotebookId, selectedPageId,
    selectNotebook, selectPage, createPage, updatePageTitle, deletePage,
    deleteNotebook, duplicateNotebook, updateNotebook, days,
  } = useNotesStore();
  const { setCreateNotebookOpen, addNotification, setConfirmModal } = useAppStore();

  const [expandedNotebook, setExpandedNotebook] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'notebook' | 'page'; id: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState<{ type: 'notebook' | 'page'; id: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const selectedDay = days.find((d) => d.id === selectedDayId);

  // Expand selected notebook
  useEffect(() => {
    if (selectedNotebookId) setExpandedNotebook(selectedNotebookId);
  }, [selectedNotebookId]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleNotebookClick = (notebookId: string) => {
    if (expandedNotebook === notebookId) {
      setExpandedNotebook(null);
    } else {
      setExpandedNotebook(notebookId);
    }
    selectNotebook(notebookId);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'notebook' | 'page', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  const handleNewPage = async (notebookId: string) => {
    try {
      await createPage(notebookId, 'Untitled');
      await queueSync('update', 'notebook', notebookId);
      addNotification('success', 'Page created');
    } catch {
      addNotification('error', 'Failed to create page');
    }
  };

  const handleDeleteNotebook = (id: string) => {
    setContextMenu(null);
    setConfirmModal({
      open: true,
      title: 'Delete Notebook',
      message: 'Are you sure? This will delete the notebook and all its pages.',
      onConfirm: async () => {
        await deleteNotebook(id);
        await queueSync('delete', 'notebook', id);
        addNotification('success', 'Notebook deleted');
      },
    });
  };

  const handleDeletePage = (id: string) => {
    setContextMenu(null);
    setConfirmModal({
      open: true,
      title: 'Delete Page',
      message: 'Are you sure you want to delete this page?',
      onConfirm: async () => {
        await deletePage(id);
        await queueSync('delete', 'page', id);
        addNotification('success', 'Page deleted');
      },
    });
  };

  const handleDuplicateNotebook = async (id: string) => {
    setContextMenu(null);
    await duplicateNotebook(id);
    addNotification('success', 'Notebook duplicated');
  };

  const handleStartRename = (type: 'notebook' | 'page', id: string, currentTitle: string) => {
    setContextMenu(null);
    setEditingTitle({ type, id });
    setEditTitle(currentTitle);
  };

  const handleFinishRename = async () => {
    if (!editingTitle || !editTitle.trim()) {
      setEditingTitle(null);
      return;
    }
    if (editingTitle.type === 'notebook') {
      await updateNotebook(editingTitle.id, { title: editTitle.trim() });
      await queueSync('update', 'notebook', editingTitle.id);
    } else {
      await updatePageTitle(editingTitle.id, editTitle.trim());
      await queueSync('update', 'page', editingTitle.id);
    }
    setEditingTitle(null);
  };

  if (!selectedDayId) {
    return (
      <aside className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Select a day to view notebooks</p>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden glass-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {selectedDay ? formatDateFull(selectedDay.date) : 'Notebooks'}
        </span>
        <button
          onClick={() => setCreateNotebookOpen(true)}
          className="p-1.5 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--color-accent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dim)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="New Notebook"
          aria-label="Create new notebook"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Notebook List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Notebook className="w-8 h-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm text-center mb-3" style={{ color: 'var(--color-text-tertiary)' }}>No notebooks yet</p>
            <button
              onClick={() => setCreateNotebookOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <Plus className="w-3 h-3" />
              New Notebook
            </button>
          </div>
        ) : (
          notebooks.map((nb) => {
            const isSelected = nb.id === selectedNotebookId;
            const isExpanded = expandedNotebook === nb.id;
            const nbPages = isExpanded ? pages : [];

            return (
              <div key={nb.id} className="mb-1">
                {/* Notebook Item */}
                <div
                  className="flex items-center gap-2 px-2 py-2 rounded-lg transition-colors cursor-pointer group"
                  style={{ background: isSelected ? 'var(--color-bg-active)' : 'transparent' }}
                  onClick={() => handleNotebookClick(nb.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'notebook', nb.id)}
                  onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} />

                  {editingTitle?.type === 'notebook' && editingTitle.id === nb.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingTitle(null); }}
                      className="flex-1 text-sm bg-transparent outline-none px-1 rounded"
                      style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate" style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {nb.title}
                    </span>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'notebook', nb.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    aria-label="Notebook options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Pages List (when expanded) */}
                {isExpanded && isSelected && (
                  <div className="ml-5 pl-3 mt-0.5" style={{ borderLeft: '1px solid var(--color-border)' }}>
                    {nbPages.map((page) => {
                      const pageSelected = page.id === selectedPageId;
                      return (
                        <div
                          key={page.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group"
                          style={{ background: pageSelected ? 'var(--color-bg-hover)' : 'transparent' }}
                          onClick={() => selectPage(page.id)}
                          onContextMenu={(e) => handleContextMenu(e, 'page', page.id)}
                          onMouseEnter={(e) => !pageSelected && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                          onMouseLeave={(e) => !pageSelected && (e.currentTarget.style.background = 'transparent')}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pageSelected ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }} />

                          {editingTitle?.type === 'page' && editingTitle.id === page.id ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={handleFinishRename}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingTitle(null); }}
                              className="flex-1 text-xs bg-transparent outline-none px-1 rounded"
                              style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="flex-1 text-xs truncate" style={{ color: pageSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                              {page.title}
                            </span>
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'page', page.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity cursor-pointer"
                            style={{ color: 'var(--color-text-tertiary)' }}
                            aria-label="Page options"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => handleNewPage(nb.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer w-full"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                    >
                      <Plus className="w-3 h-3" />
                      New Page
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'notebook' ? (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const nb = notebooks.find((n) => n.id === contextMenu.id);
                  if (nb) handleStartRename('notebook', nb.id, nb.title);
                }}
              >
                <Pencil className="w-3.5 h-3.5" /> Rename
              </button>
              <button className="context-menu-item" onClick={() => handleDuplicateNotebook(contextMenu.id)}>
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item danger" onClick={() => handleDeleteNotebook(contextMenu.id)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          ) : (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const page = pages.find((p) => p.id === contextMenu.id);
                  if (page) handleStartRename('page', page.id, page.title);
                }}
              >
                <Pencil className="w-3.5 h-3.5" /> Rename
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item danger" onClick={() => handleDeletePage(contextMenu.id)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
