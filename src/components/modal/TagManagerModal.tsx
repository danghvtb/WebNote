import { useEffect, useMemo, useState } from 'react';
import { Plus, Tag as TagIcon, Trash2, X, Check, Pencil } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { getAllVaultPages } from '../../services/database/repository';
import { queueSync } from '../../services/sync/syncManager';

export function TagManagerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tags, loadTags, createTag, renameTag, deleteTag } = useNotesStore();
  const { addNotification, setConfirmModal } = useAppStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    loadTags();
    getAllVaultPages().then((pages) => {
      const next: Record<string, number> = {};
      pages.forEach((p) => (p.tagIds || []).forEach((id) => { next[id] = (next[id] || 0) + 1; }));
      setUsage(next);
    });
  }, [isOpen, loadTags]);

  const sortedTags = useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags]);
  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try { const tag = await createTag(newName); await queueSync('create', 'tag', tag.id); setNewName(''); addNotification('success', `Đã thêm thẻ "${tag.name}"`); }
    catch (e) { addNotification('error', e instanceof Error ? e.message : 'Không thể thêm thẻ'); }
  };

  const handleRename = async (id: string) => {
    try { await renameTag(id, editingName); await queueSync('update', 'tag', id); setEditingId(null); addNotification('success', 'Đã đổi tên thẻ'); }
    catch (e) { addNotification('error', e instanceof Error ? e.message : 'Không thể đổi tên thẻ'); }
  };

  const handleDelete = (id: string, name: string) => {
    const count = usage[id] || 0;
    setConfirmModal({ open: true, title: 'Xóa thẻ', message: `Xóa "${name}" sẽ gỡ thẻ khỏi ${count} page. Bạn có chắc không?`, onConfirm: async () => {
      const affected = await deleteTag(id);
      await queueSync('delete', 'tag', id);
      await Promise.all(affected.map((pageId) => queueSync('update', 'page', pageId)));
      addNotification('success', `Đã xóa thẻ "${name}"`);
    } });
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2"><TagIcon className="w-5 h-5 text-cyan-400" /><h2 className="text-base font-semibold">Quản lý thẻ</h2></div>
        <button onClick={onClose} className="p-1 cursor-pointer"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2"><input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Tên thẻ mới" className="flex-1 rounded-lg px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] outline-none text-sm" /><button onClick={handleCreate} className="px-3 rounded-lg bg-cyan-600 text-white flex items-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Thêm</button></div>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {sortedTags.map((tag) => editingId === tag.id ? <div key={tag.id} className="flex gap-2 items-center"><input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename(tag.id)} className="flex-1 rounded px-2 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm" /><button onClick={() => handleRename(tag.id)} className="p-1 text-emerald-400 cursor-pointer"><Check className="w-4 h-4" /></button><button onClick={() => setEditingId(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button></div> : <div key={tag.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--color-bg-hover)]"><span className="flex-1 text-sm">#{tag.name}</span><span className="text-xs text-[var(--color-text-tertiary)]">{usage[tag.id] || 0} page</span><button onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }} className="p-1 text-[var(--color-text-tertiary)] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => handleDelete(tag.id, tag.name)} className="p-1 text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
          {sortedTags.length === 0 && <p className="text-sm text-center py-6 text-[var(--color-text-tertiary)]">Chưa có thẻ nào</p>}
        </div>
      </div>
    </div>
  </div>;
}
