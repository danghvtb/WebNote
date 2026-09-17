import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, FolderKanban, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useWorkReportStore } from '../../stores/workReportStore';
import { useAppStore } from '../../stores/appStore';
import { getAllWorkReports } from '../../services/database/repository';

export function ProjectManagerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    projects,
    archivedProjects,
    loadProjects,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
  } = useWorkReportStore();
  const { addNotification, setConfirmModal } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    loadProjects();
    getAllWorkReports(true).then((reports) => {
      const counts: Record<string, number> = {};
      reports.forEach((report) => report.projectEntries.forEach((entry) => {
        counts[entry.projectId] = (counts[entry.projectId] || 0) + 1;
      }));
      setUsage(counts);
    });
  }, [isOpen, loadProjects, projects.length, archivedProjects.length]);

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const sortedArchived = useMemo(() => [...archivedProjects].sort((a, b) => a.name.localeCompare(b.name)), [archivedProjects]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createProject(newName, newDescription);
      setNewName('');
      setNewDescription('');
      addNotification('success', 'Đã thêm dự án');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể thêm dự án');
    }
  };

  const startEdit = (project: { id: string; name: string; description?: string }) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setEditingDescription(project.description || '');
  };

  const handleSave = async (id: string) => {
    try {
      await updateProject(id, { name: editingName, description: editingDescription });
      setEditingId(null);
      addNotification('success', 'Đã cập nhật dự án');
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Không thể cập nhật dự án');
    }
  };

  const handleArchive = (id: string, name: string) => {
    const count = usage[id] || 0;
    setConfirmModal({
      open: true,
      title: 'Xóa dự án',
      message: `Xóa dự án “${name}”? ${count} báo cáo lịch sử sẽ được giữ nguyên tên và nội dung.`,
      onConfirm: async () => {
        await archiveProject(id);
        addNotification('success', `Đã xóa dự án “${name}”; báo cáo cũ vẫn được giữ nguyên.`);
      },
    });
  };

  const renderProject = (project: typeof projects[number], archived = false) => (
    <div key={project.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
      {editingId === project.id ? (
        <div className="space-y-2">
          <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSave(project.id); }} className="w-full rounded-md px-2 py-1.5 text-sm bg-transparent outline-none" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
          <input value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} placeholder="Mô tả (không bắt buộc)" className="w-full rounded-md px-2 py-1.5 text-xs bg-transparent outline-none" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }} />
          <div className="flex justify-end gap-1"><button type="button" onClick={() => handleSave(project.id)} className="p-1 text-emerald-400 cursor-pointer"><Check className="w-4 h-4" /></button><button type="button" onClick={() => setEditingId(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button></div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {archived ? <Archive className="w-4 h-4 text-amber-400" /> : <FolderKanban className="w-4 h-4 text-cyan-400" />}
          <div className="min-w-0 flex-1"><p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{project.name}</p>{project.description && <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{project.description}</p>}</div>
          <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>{usage[project.id] || 0} báo cáo</span>
          {!archived && <button type="button" onClick={() => startEdit(project)} className="p-1 cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }} aria-label="Sửa dự án"><Pencil className="w-3.5 h-3.5" /></button>}
          {archived ? <button type="button" onClick={async () => { try { await restoreProject(project.id); addNotification('success', 'Đã khôi phục dự án'); } catch (error) { addNotification('error', error instanceof Error ? error.message : 'Không thể khôi phục dự án'); } }} className="p-1 text-emerald-400 cursor-pointer" aria-label="Khôi phục dự án"><RotateCcw className="w-3.5 h-3.5" /></button> : <button type="button" onClick={() => handleArchive(project.id, project.name)} className="p-1 text-rose-400 cursor-pointer" aria-label="Xóa dự án"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]"><div className="flex items-center gap-2"><FolderKanban className="w-5 h-5 text-cyan-400" /><h2 className="text-base font-semibold">Quản lý dự án</h2></div><button type="button" onClick={onClose} className="p-1 cursor-pointer"><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-65px)]">
          <div className="space-y-2"><div className="flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleCreate(); }} placeholder="Tên dự án mới" className="flex-1 rounded-lg px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] outline-none text-sm" /><button type="button" onClick={handleCreate} className="px-3 rounded-lg bg-cyan-600 text-white flex items-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Thêm</button></div><input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Mô tả (không bắt buộc)" className="w-full rounded-lg px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] outline-none text-xs" /></div>
          <div className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Đang hoạt động ({sortedProjects.length})</h3>{sortedProjects.map((project) => renderProject(project))}{sortedProjects.length === 0 && <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>Chưa có dự án.</p>}</div>
          {sortedArchived.length > 0 && <div className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Đã xóa ({sortedArchived.length})</h3>{sortedArchived.map((project) => renderProject(project, true))}</div>}
        </div>
      </div>
    </div>
  );
}
