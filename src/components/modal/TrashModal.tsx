// ============================================================
// MyNotes — Trash Modal (Thùng rác ghi chú)
// Allows viewing soft-deleted pages, restoring them, or
// permanently deleting them with cascade cleanup.
// ============================================================

import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, X, AlertOctagon, FileText, Search } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { queueSync } from '../../services/sync/syncManager';
import { formatDateDisplay } from '../../utils';

export function TrashModal() {
  const { trashModalOpen, setTrashModalOpen, addNotification } = useAppStore();
  const {
    deletedPages,
    loadDeletedPages,
    restorePage,
    permanentlyDeletePage,
    notebooks,
  } = useNotesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (trashModalOpen) {
      loadDeletedPages();
      setSearchTerm('');
      setConfirmDeleteId(null);
    }
  }, [trashModalOpen, loadDeletedPages]);

  if (!trashModalOpen) return null;

  const filteredPages = deletedPages.filter((page) =>
    (page.title || 'Untitled').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestore = async (pageId: string, title: string) => {
    try {
      await restorePage(pageId);
      await queueSync('update', 'page', pageId);
      addNotification('success', `Đã khôi phục ghi chú "${title || 'Untitled'}"`);
    } catch {
      addNotification('error', 'Khôi phục ghi chú thất bại');
    }
  };

  const handlePermanentDelete = async (pageId: string, title: string) => {
    try {
      await permanentlyDeletePage(pageId);
      await queueSync('delete', 'page', pageId);
      setConfirmDeleteId(null);
      addNotification('info', `Đã xóa vĩnh viễn "${title || 'Untitled'}"`);
    } catch {
      addNotification('error', 'Không thể xóa vĩnh viễn ghi chú');
    }
  };

  const handleEmptyTrash = async () => {
    if (deletedPages.length === 0) return;
    try {
      for (const p of deletedPages) {
        await permanentlyDeletePage(p.id);
        await queueSync('delete', 'page', p.id);
      }
      setConfirmDeleteId(null);
      addNotification('info', 'Đã dọn sạch toàn bộ thùng rác!');
    } catch {
      addNotification('error', 'Có lỗi xảy ra khi dọn sạch thùng rác');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={() => setTrashModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh] animate-scale-in overflow-hidden shadow-2xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}
            >
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Thùng rác ghi chú</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                >
                  {deletedPages.length}
                </span>
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Các ghi chú đã xóa sẽ được lưu ở đây. Bạn có thể khôi phục hoặc xóa vĩnh viễn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deletedPages.length > 0 && (
              <button
                onClick={() => setConfirmDeleteId('all')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-600/80 transition-all cursor-pointer border border-rose-500/30"
              >
                Dọn sạch thùng rác
              </button>
            )}
            <button
              onClick={() => setTrashModalOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Filter */}
        {deletedPages.length > 0 && (
          <div
            className="px-6 py-3 border-b flex items-center gap-2"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
          >
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm ghi chú trong thùng rác..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {deletedPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Trash2 className="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-300 mb-1">Thùng rác đang trống</p>
              <p className="text-xs text-slate-500">Không có ghi chú nào bị xóa gần đây.</p>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Không tìm thấy ghi chú nào khớp với từ khóa "{searchTerm}".
            </div>
          ) : (
            filteredPages.map((page) => {
              const nb = notebooks.find((n) => n.id === page.notebookId);
              const isConfirming = confirmDeleteId === page.id;

              return (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-3 rounded-xl border transition-colors group"
                  style={{
                    background: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {page.title || 'Untitled'}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {nb && (
                          <span className="truncate max-w-[140px] text-slate-400">
                            📁 {nb.title}
                          </span>
                        )}
                        <span>•</span>
                        <span>Đã xóa: {formatDateDisplay(page.updatedAt.slice(0, 10))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 animate-scale-in">
                        <span className="text-xs text-rose-400 font-semibold mr-1">Xóa vĩnh viễn?</span>
                        <button
                          onClick={() => handlePermanentDelete(page.id, page.title)}
                          className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                        >
                          Xóa
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-md text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(page.id, page.title)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 transition-all cursor-pointer"
                          title="Khôi phục về sổ tay ban đầu"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Khôi phục</span>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(page.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                          title="Xóa vĩnh viễn khỏi bộ nhớ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal footer alert when deleting all */}
        {confirmDeleteId === 'all' && (
          <div
            className="px-6 py-3 border-t flex items-center justify-between bg-rose-950/40"
            style={{ borderColor: 'rgba(244,63,94,0.3)' }}
          >
            <div className="flex items-center gap-2 text-rose-300 text-xs">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Hành động này sẽ xóa vĩnh viễn toàn bộ các trang trong thùng rác và không thể phục hồi.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
              >
                Xác nhận dọn sạch
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
