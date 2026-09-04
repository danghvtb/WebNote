// ============================================================
// MyNotes — Create Folder Prompt
// Shown when no MyNotes folder exists on Google Drive.
// ============================================================

import { useState } from 'react';
import { FolderPlus, Cloud } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { createRootFolder } from '../../services/google/rootFolderManager';
import { useNotesStore } from '../../stores/notesStore';

export function CreateFolderPrompt() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setRootFolderId, setNeedsFolderCreation } = useAppStore();

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const folderId = await createRootFolder();
      setRootFolderId(folderId);
      setNeedsFolderCreation(false);

      // Initialize for today
      const notesStore = useNotesStore.getState();
      await notesStore.selectToday();
      await notesStore.loadDays();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="animate-scale-in w-full max-w-md px-6">
        <div className="p-8 rounded-2xl" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent-dim)' }}>
              <FolderPlus className="w-7 h-7" style={{ color: 'var(--color-accent)' }} />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-center mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Set up MyNotes
          </h2>
          <p className="text-center mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Create a <strong>"MyNotes"</strong> folder in your Google Drive to store your notes securely.
          </p>

          <div className="flex items-center gap-3 p-3 rounded-lg mb-6" style={{ background: 'var(--color-bg-tertiary)' }}>
            <Cloud className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                All your notes will be stored in:
              </p>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                Google Drive / MyNotes /
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                useAppStore.getState().logout();
                setNeedsFolderCreation(false);
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
              style={{ background: 'var(--color-accent)', color: '#FFFFFF' }}
            >
              {creating ? 'Creating...' : 'Create Folder'}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
