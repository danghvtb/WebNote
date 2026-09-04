// ============================================================
// MyNotes — Home Page
// Shown when no notebook/page is selected.
// ============================================================

import { useEffect } from 'react';
import { Search, Plus, Notebook, Clock, Sparkles } from 'lucide-react';
import { useNotesStore } from '../../stores/notesStore';
import { useAppStore } from '../../stores/appStore';
import { getGreeting, timeAgo } from '../../utils';
import { seedDemoVault } from '../../services/database/seedDemo';
import { queueSync } from '../../services/sync/syncManager';

export function HomePage() {
  const { notebooks, recentNotebooks, selectNotebook, loadRecentNotebooks, loadDays } = useNotesStore();
  const { toggleSearch, setCreateNotebookOpen, user, addNotification } = useAppStore();

  useEffect(() => {
    loadRecentNotebooks();
  }, [loadRecentNotebooks]);

  const handleGenerateDemoNotes = async () => {
    try {
      const { notebook, pages } = await seedDemoVault();
      await loadDays();
      await loadRecentNotebooks();
      await selectNotebook(notebook.id);
      if (pages && pages.length > 0) {
        useNotesStore.getState().selectPage(pages[0].id);
      }
      queueSync('create', 'notebook', notebook.id);
      addNotification('success', 'Đã nạp và mở bộ ghi chú hướng dẫn mẫu!');
    } catch (err) {
      console.error(err);
      addNotification('error', 'Có lỗi khi tạo bộ ghi chú mẫu.');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 md:px-12 lg:px-16 py-10 max-w-2xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {getGreeting()} 👋
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'What are you working on?'}
        </p>
      </div>

      {/* Search Bar */}
      <button
        onClick={toggleSearch}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-8 transition-colors cursor-pointer"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        aria-label="Search notes"
      >
        <Search className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Search notes...</span>
        <kbd className="ml-auto text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
          Ctrl+K
        </kbd>
      </button>

      {/* Today's Notebooks */}
      {notebooks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            Today
          </h2>
          <div className="space-y-1">
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => selectNotebook(nb.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{nb.title}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                  {nb.pageIds.length} {nb.pageIds.length === 1 ? 'page' : 'pages'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New Notebook & Demo Notes Buttons */}
      <div className="space-y-2.5 mb-8">
        <button
          onClick={() => setCreateNotebookOpen(true)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
          style={{ border: '1px dashed var(--color-border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>New Notebook</span>
        </button>

        <button
          onClick={handleGenerateDemoNotes}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/30 hover:border-purple-500/60 shadow-lg shadow-purple-950/20"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-xs font-bold text-purple-200">📚 Tạo ghi chú mẫu cho tất cả các tính năng</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
            Tutorial Vault
          </span>
        </button>
      </div>

      {/* Recent Notebooks */}
      {recentNotebooks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
            <Clock className="w-3 h-3" /> Recent
          </h2>
          <div className="space-y-1">
            {recentNotebooks.slice(0, 5).map((nb) => (
              <button
                key={nb.id}
                onClick={() => selectNotebook(nb.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer text-left"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Notebook className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{nb.title}</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                  {timeAgo(nb.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
