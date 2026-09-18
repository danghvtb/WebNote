// ============================================================
// MyNotes — Notebook Sidebar
// Middle column: Notebooks for selected day + page list.
// ============================================================

/* oxlint-disable react(set-state-in-effect) -- sidebar derives state from loaded records. */
import { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Notebook, FileText, ClipboardList, ChevronRight, ChevronDown, Pencil, Copy, Trash2, AlertTriangle, Pin } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { formatDateFull } from '../../utils';
import { dateFromDayId } from '../../utils/timelineGrouping';
import { getNotebookOverdueCount, getPageOverdueCount } from '../../utils/taskUtils';
import { getAllVaultPages } from '../../services/database/repository';
import { queueSync } from '../../services/sync/syncManager';
import type { Page } from '../../types';
import { useWorkReportStore } from '../../stores/workReportStore';

export function NotebookSidebar() {
  const {
    notebooks, pages, selectedDayId, selectedNotebookId, selectedPageId,
    selectNotebook, selectPage, createPage, updatePageTitle, deletePage,
    deleteNotebook, duplicateNotebook, updateNotebook, setNotebookPinned, setPagePinned, days,
  } = useNotesStore();
  const { setCreateNotebookOpen, addNotification, setConfirmModal, setTrashModalOpen } = useAppStore();
  const { dayReport, loadReportForDay, openOrCreateReport, deleteReport } = useWorkReportStore();

  // Track expanded state for notebooks (Set of notebook IDs)
  const [expandedNotebookIds, setExpandedNotebookIds] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'notebook' | 'page'; id: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState<{ type: 'notebook' | 'page'; id: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [allVaultPages, setAllVaultPages] = useState<Page[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Fetch 100% of all vault pages for accurate notebook overdue badge counts
  useEffect(() => {
    // Refresh derived overdue counts after the source collections change.
    // oxlint-disable-next-line react(set-state-in-effect)
    getAllVaultPages().then((p) => setAllVaultPages(p));
  }, [pages, notebooks]);

  const pagesForOverdue = allVaultPages.length > 0 ? allVaultPages : pages;

  useEffect(() => {
    if (selectedDayId) loadReportForDay(selectedDayId);
  }, [selectedDayId, loadReportForDay]);

  const selectedDay = days.find((d) => d.id === selectedDayId);
  const selectedDayDate = selectedDay?.date || dateFromDayId(selectedDayId);

  // Default selected notebook to expanded when selectedNotebookId changes
  useEffect(() => {
    if (selectedNotebookId) {
      // Keep the selected notebook expanded for keyboard/mobile navigation.
      // oxlint-disable-next-line react(set-state-in-effect)
      // oxlint-disable-next-line react(set-state-in-effect)
      setExpandedNotebookIds((prev) => ({
        ...prev,
        [selectedNotebookId]: true,
      }));
    }
  }, [selectedNotebookId]);

  // Close context menu on outside click with slight delay to prevent click-race
  useEffect(() => {
    if (!contextMenu) return;

    function handleDocMouseDown(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleDocMouseDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [contextMenu]);

  // Toggle expand/collapse of a notebook
  const handleToggleExpand = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    useWorkReportStore.getState().clearSelectedReport();
    setExpandedNotebookIds((prev) => {
      const isCurrentlyExpanded = prev[notebookId] ?? (notebookId === selectedNotebookId);
      return {
        ...prev,
        [notebookId]: !isCurrentlyExpanded,
      };
    });
    selectNotebook(notebookId);
  };

  const handleNotebookClick = (notebookId: string) => {
    useWorkReportStore.getState().clearSelectedReport();
    selectNotebook(notebookId);
    setExpandedNotebookIds((prev) => ({
      ...prev,
      [notebookId]: true,
    }));
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'notebook' | 'page', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: Math.min(e.clientX, Math.max(8, window.innerWidth - 190)), y: Math.min(e.clientY, Math.max(8, window.innerHeight - 170)), type, id });
  };

  const handleOptionsButtonClick = (e: React.MouseEvent, type: 'notebook' | 'page', id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (contextMenu?.id === id) {
      setContextMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: Math.min(Math.max(10, rect.left - 120), Math.max(10, window.innerWidth - 190)),
      y: Math.min(rect.bottom + 4, Math.max(10, window.innerHeight - 170)),
      type,
      id,
    });
  };

  const handleNewPage = async (notebookId: string) => {
    useWorkReportStore.getState().clearSelectedReport();
    try {
      await createPage(notebookId, 'Chưa có tiêu đề');
      await queueSync('update', 'notebook', notebookId);
      addNotification('success', 'Đã tạo trang');
    } catch {
      addNotification('error', 'Không thể tạo trang');
    }
  };

  const handleOpenReport = async () => {
    if (!selectedDayId) return;
    setPlusMenuOpen(false);
    useNotesStore.getState().clearPageSelection();
    await openOrCreateReport(selectedDayId);
  };

  const handleDeleteReport = () => {
    if (!dayReport) return;
    setConfirmModal({
      open: true,
      title: 'Xóa báo cáo công việc',
      message: 'Báo cáo sẽ được xóa khỏi ngày này; danh mục dự án không bị ảnh hưởng.',
      onConfirm: async () => {
        await deleteReport(dayReport.id);
        addNotification('success', 'Đã xóa báo cáo công việc');
      },
    });
  };

  const handleDeleteNotebook = (id: string) => {
    setContextMenu(null);
    setConfirmModal({
      open: true,
      title: 'Xóa sổ ghi chú',
      message: 'Bạn có chắc muốn chuyển sổ ghi chú và toàn bộ trang vào thùng rác không?',
      onConfirm: async () => {
        await deleteNotebook(id);
        await queueSync('delete', 'notebook', id);
        addNotification('success', 'Đã chuyển sổ ghi chú vào thùng rác');
      },
    });
  };

  const handleDeletePage = (id: string) => {
    setContextMenu(null);
    const targetPage = pages.find((p) => p.id === id) || allVaultPages.find((p) => p.id === id);
    const pageTitle = targetPage?.title || 'Chưa có tiêu đề';

    setConfirmModal({
      open: true,
      title: 'Chuyển vào thùng rác (Move to Trash)',
      message: `Bạn có chắc chắn muốn chuyển ghi chú "${pageTitle}" vào Thùng rác không?`,
      onConfirm: async () => {
        await deletePage(id);
        await queueSync('delete', 'page', id);

        addNotification(
          'info',
          `Đã chuyển "${pageTitle}" vào Thùng rác`,
          {
            label: 'Hoàn tác',
            onClick: async () => {
              const { restorePage } = useNotesStore.getState();
              await restorePage(id);
              await queueSync('update', 'page', id);
              addNotification('success', `Đã khôi phục "${pageTitle}"`);
            },
          },
          7000
        );
      },
    });
  };

  const handleDuplicateNotebook = async (id: string) => {
    setContextMenu(null);
    await duplicateNotebook(id);
    addNotification('success', 'Đã nhân bản sổ ghi chú');
  };

  const isComposingRef = useRef(false);

  const handleStartRename = (type: 'notebook' | 'page', id: string, currentTitle: string) => {
    setContextMenu(null);
    setEditingTitle({ type, id });
    setEditTitle(currentTitle);
  };

  const handleFinishRename = async () => {
    if (isComposingRef.current) return;
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
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Chọn một ngày để xem sổ ghi chú</p>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden glass-sidebar" aria-label="Sổ ghi chú và trang">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {selectedDayDate ? formatDateFull(selectedDayDate) : 'Sổ ghi chú'}
        </span>
        <div className="relative">
          <button onClick={() => setPlusMenuOpen((open) => !open)} className="touch-target p-2 rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--color-accent)' }} title="Thêm sổ ghi chú hoặc báo cáo" aria-label="Thêm sổ ghi chú hoặc báo cáo" aria-expanded={plusMenuOpen}><Plus className="w-4 h-4" /></button>
          {plusMenuOpen && <div className="absolute right-0 top-8 z-30 w-48 rounded-lg p-1 shadow-xl" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
            <button type="button" onClick={() => { setPlusMenuOpen(false); setCreateNotebookOpen(true); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left cursor-pointer hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)' }}><Notebook className="w-3.5 h-3.5" /> Sổ ghi chú</button>
            <button type="button" onClick={handleOpenReport} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left cursor-pointer hover:bg-[var(--color-bg-hover)]" style={{ color: 'var(--color-text-secondary)' }}><ClipboardList className="w-3.5 h-3.5" /> Báo cáo công việc</button>
          </div>}
        </div>
      </div>

      {/* Notebook List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {dayReport && <div className="mb-3">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer" style={{ background: useWorkReportStore.getState().selectedReportId === dayReport.id ? 'var(--color-bg-active)' : 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }} onClick={handleOpenReport}>
            <ClipboardList className="w-4 h-4 flex-shrink-0 text-cyan-400" />
            <span className="flex-1 min-w-0 text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>Báo cáo công việc {selectedDayDate ? selectedDayDate.split('-').reverse().join('/') : ''}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteReport(); }} className="p-1 text-rose-400 cursor-pointer" aria-label="Xóa báo cáo"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>}
        {notebooks.length === 0 && !dayReport ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Notebook className="w-8 h-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm text-center mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Chưa có sổ ghi chú</p>
            <button
              onClick={() => setCreateNotebookOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
            >
              <Plus className="w-3 h-3" />
              Sổ ghi chú mới
            </button>
          </div>
        ) : notebooks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Chưa có sổ ghi chú trong ngày này.</p>
            <button type="button" onClick={() => setCreateNotebookOpen(true)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}><Plus className="w-3 h-3" /> Thêm sổ ghi chú</button>
          </div>
        ) : (
          notebooks.map((nb) => {
            const isSelected = nb.id === selectedNotebookId;
            const isExpanded = expandedNotebookIds[nb.id] ?? isSelected;
            const nbPages = isExpanded ? pages : [];

            return (
              <div key={nb.id} className="mb-1">
                {/* Notebook Item Bar */}
                <div
                  className="flex items-center gap-2 px-2 py-2 rounded-lg transition-colors cursor-pointer group"
                  style={{ background: isSelected ? 'var(--color-bg-active)' : 'transparent' }}
                  onClick={() => handleNotebookClick(nb.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'notebook', nb.id)}
                  onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Chevron Toggle Button */}
                  <button
                    onClick={(e) => handleToggleExpand(e, nb.id)}
                    className="touch-target p-2 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title={isExpanded ? 'Thu gọn sổ ghi chú' : 'Mở rộng sổ ghi chú'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    )}
                  </button>

                  <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} />

                  {editingTitle?.type === 'notebook' && editingTitle.id === nb.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onCompositionStart={() => { isComposingRef.current = true; }}
                      onCompositionEnd={() => { isComposingRef.current = false; }}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isComposingRef.current) handleFinishRename(); if (e.key === 'Escape') setEditingTitle(null); }}
                      className="flex-1 text-sm bg-transparent outline-none px-1 rounded"
                      style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                      <span className="text-sm truncate" style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {nb.title}
                      </span>
                      {nb.isPinned && <Pin className="w-3 h-3 ml-1 flex-shrink-0 text-amber-300" aria-label="Đã ghim" />}
                      {getNotebookOverdueCount(nb.id, pagesForOverdue) > 0 && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-rose-950/90 border border-rose-500/80 text-rose-300 text-[10px] font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse" title="Notebook chứa công việc quá hạn!">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>{getNotebookOverdueCount(nb.id, pagesForOverdue)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions: Direct Trash & 3-Dots Button */}
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNotebook(nb.id); }}
                      className="touch-target opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      title="Xóa sổ ghi chú"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleOptionsButtonClick(e, 'notebook', nb.id)}
                      className="touch-target p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                      title="Tùy chọn sổ ghi chú"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pages List (when expanded) */}
                {isExpanded && isSelected && (
                  <div className="ml-5 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: '1px solid var(--color-border)' }}>
                    {nbPages.map((page) => {
                      const pageSelected = page.id === selectedPageId;
                      const pageOverdue = getPageOverdueCount(page);

                      return (
                        <div
                          key={page.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer group"
                          style={{ background: pageSelected ? 'var(--color-bg-hover)' : 'transparent' }}
                          onClick={() => { useWorkReportStore.getState().clearSelectedReport(); selectPage(page.id); }}
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
                              onCompositionStart={() => { isComposingRef.current = true; }}
                              onCompositionEnd={() => { isComposingRef.current = false; }}
                              onBlur={handleFinishRename}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !isComposingRef.current) handleFinishRename(); if (e.key === 'Escape') setEditingTitle(null); }}
                              className="flex-1 text-xs bg-transparent outline-none px-1 rounded"
                              style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                              <span className="text-xs truncate" style={{ color: pageSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                                {page.title}
                              </span>
                              {page.isPinned && <Pin className="w-3 h-3 ml-1 flex-shrink-0 text-amber-300" aria-label="Đã ghim" />}
                              {pageOverdue > 0 && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/70 text-rose-300 text-[9px] font-bold flex items-center gap-0.5 shadow-[0_0_6px_rgba(244,63,94,0.3)]" title={`${pageOverdue} công việc quá hạn`}>
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                  <span>{pageOverdue}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Actions: Direct Trash & 3-Dots Button */}
                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                              className="touch-target opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                              title="Xóa trang"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleOptionsButtonClick(e, 'page', page.id)}
                              className="touch-target p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                              title="Tùy chọn trang"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>
                          </div>
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
                      Trang mới
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer: Trash Bin Entry */}
      <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => setTrashModalOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer w-full"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Thùng rác ghi chú</span>
        </button>
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
                onClick={async () => { setContextMenu(null); const nb = notebooks.find((n) => n.id === contextMenu.id); if (nb) { await setNotebookPinned(nb.id, !nb.isPinned); await queueSync('update', 'notebook', nb.id); addNotification('success', nb.isPinned ? 'Đã bỏ ghim sổ ghi chú' : 'Đã ghim sổ ghi chú'); } }}
              >
                <Pin className="w-3.5 h-3.5" /> {notebooks.find((n) => n.id === contextMenu.id)?.isPinned ? 'Bỏ ghim' : 'Ghim'}
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  const nb = notebooks.find((n) => n.id === contextMenu.id);
                  if (nb) handleStartRename('notebook', nb.id, nb.title);
                }}
              >
                <Pencil className="w-3.5 h-3.5" /> Đổi tên
              </button>
              <button className="context-menu-item" onClick={() => handleDuplicateNotebook(contextMenu.id)}>
                <Copy className="w-3.5 h-3.5" /> Nhân bản
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item danger" onClick={() => handleDeleteNotebook(contextMenu.id)}>
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </>
          ) : (
            <>
              <button
                className="context-menu-item"
                onClick={async () => { setContextMenu(null); const page = pages.find((p) => p.id === contextMenu.id); if (page) { await setPagePinned(page.id, !page.isPinned); await queueSync('update', 'page', page.id); addNotification('success', page.isPinned ? 'Đã bỏ ghim ghi chú' : 'Đã ghim ghi chú'); } }}
              >
                <Pin className="w-3.5 h-3.5" /> {pages.find((p) => p.id === contextMenu.id)?.isPinned ? 'Bỏ ghim' : 'Ghim'}
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  const page = pages.find((p) => p.id === contextMenu.id);
                  if (page) handleStartRename('page', page.id, page.title);
                }}
              >
                <Pencil className="w-3.5 h-3.5" /> Đổi tên
              </button>
              <div className="context-menu-separator" />
              <button className="context-menu-item danger" onClick={() => handleDeletePage(contextMenu.id)}>
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
