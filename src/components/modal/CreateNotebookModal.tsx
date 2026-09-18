// ============================================================
// MyNotes — Create Notebook Modal
// ============================================================

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useNotesStore } from '../../stores/notesStore';
import { queueSync } from '../../services/sync/syncManager';

export function CreateNotebookModal() {
  const { createNotebookOpen, setCreateNotebookOpen, addNotification } = useAppStore();
  const { createNotebook, selectedDayId } = useNotesStore();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  if (!createNotebookOpen) return null;

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const nb = await createNotebook(title.trim(), selectedDayId || undefined);
      await queueSync('create', 'notebook', nb.id);
      setTitle('');
      setCreateNotebookOpen(false);
      addNotification('success', `Created "${nb.title}"`);
    } catch (err) {
      addNotification('error', 'Failed to create notebook');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      setTitle('');
      setCreateNotebookOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={() => { setTitle(''); setCreateNotebookOpen(false); }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 animate-scale-in"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Create Notebook
          </h2>
          <button
            onClick={() => { setTitle(''); setCreateNotebookOpen(false); }}
            className="p-1 rounded-lg cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title Input */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Notebook title..."
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-transparent outline-none"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setTitle(''); setCreateNotebookOpen(false); }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
