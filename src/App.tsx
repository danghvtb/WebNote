// ============================================================
// MyNotes — Main App Component
// Root component: handles auth state and renders appropriate view.
// ============================================================

import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { LoginPage } from './components/auth/LoginPage';
import { CreateFolderPrompt } from './components/auth/CreateFolderPrompt';
import { AppLayout } from './components/layout/AppLayout';
import { SearchModal } from './components/search/SearchModal';
import { CreateNotebookModal } from './components/modal/CreateNotebookModal';
import { ConfirmModal } from './components/modal/ConfirmModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { Toasts } from './components/common/Toasts';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { initNetworkListeners, onSyncStatusChange } from './services/sync/syncManager';

import { GraphViewModal } from './components/modal/GraphViewModal';
import { TaskManagerModal } from './components/modal/TaskManagerModal';
import { ExportModal } from './components/modal/ExportModal';

function AppContent() {
  const {
    isLoggedIn, needsFolderCreation, setSyncStatus, setLastSyncTime, setTheme,
    setAuth, setRootFolderId, setInitialized,
  } = useAppStore();

  // Restore session from localStorage on reload
  useEffect(() => {
    const savedUserStr = localStorage.getItem('mynotes_user');
    const savedToken = localStorage.getItem('mynotes_token');
    const savedFolder = localStorage.getItem('mynotes_root_folder');

    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setAuth(savedUser, savedToken);

        if (savedFolder) {
          setRootFolderId(savedFolder);
        }

        // Initialize Google Auth script & root folder in background
        import('./services/google/auth').then(async ({ initGoogleAuth }) => {
          try {
            await initGoogleAuth();
            const { ensureRootFolder } = await import('./services/google/rootFolderManager');
            const res = await ensureRootFolder();
            if (res.status === 'found') {
              setRootFolderId(res.folderId);
            }
          } catch (err) {
            console.warn('[App] Background auth/folder init warning:', err);
          }
        });

        // Auto load notes from IndexedDB
        import('./stores/notesStore').then(({ useNotesStore }) => {
          const notesStore = useNotesStore.getState();
          notesStore.loadDays();
          notesStore.loadRecentNotebooks();
          notesStore.selectToday();
        });

        setInitialized(true);
      } catch (err) {
        console.warn('[App] Session restore error:', err);
      }
    }
  }, [setAuth, setRootFolderId, setInitialized]);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('mynotes_theme') as 'dark' | 'light' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }
  }, [setTheme]);

  // Initialize network listeners
  useEffect(() => {
    initNetworkListeners();
  }, []);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribe = onSyncStatusChange((status, message) => {
      setSyncStatus(status, message);
      if (status === 'saved') {
        setLastSyncTime(new Date().toISOString());
      }
    });
    return unsubscribe;
  }, [setSyncStatus, setLastSyncTime]);

  // 30-Minute Deadline Warning Monitor
  const { addNotification } = useAppStore();
  useEffect(() => {
    const alertedTaskIds = new Set<string>();

    const checkUpcomingDeadlines = async () => {
      try {
        const { getAllVaultPages, getAllVaultNotebooks } = await import('./services/database/repository');
        const { parseAllTasks, isValidDueDate } = await import('./utils/taskUtils');

        const [pages, notebooks] = await Promise.all([getAllVaultPages(), getAllVaultNotebooks()]);
        const tasks = parseAllTasks(pages, notebooks, true);

        const now = Date.now();
        const THIRTY_MINS_MS = 30 * 60 * 1000;

        tasks.forEach((t) => {
          if (t.completed || !isValidDueDate(t.dueDate)) return;

          const dueMs = new Date(t.dueDate.includes('T') ? t.dueDate : `${t.dueDate}T18:00`).getTime();
          const diffMs = dueMs - now;

          // If task deadline is within 30 minutes (between 0 and 30 mins from now)
          if (diffMs > 0 && diffMs <= THIRTY_MINS_MS && !alertedTaskIds.has(t.id)) {
            alertedTaskIds.add(t.id);
            const remainingMins = Math.ceil(diffMs / (60 * 1000));
            addNotification(
              'warning',
              `⏰ CẢNH BÁO DEADLINE: Task "${t.text.slice(0, 45)}" còn ${remainingMins} phút nữa là đến hạn!`
            );
          }
        });
      } catch (err) {
        console.warn('[App] Deadline monitor error:', err);
      }
    };

    // Initial check
    checkUpcomingDeadlines();

    // Check every 30 seconds
    const interval = setInterval(checkUpcomingDeadlines, 30000);
    return () => clearInterval(interval);
  }, [addNotification]);

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Auth flow routing
  if (!isLoggedIn) {
    return <LoginPage />;
  }

  if (needsFolderCreation) {
    return <CreateFolderPrompt />;
  }

  return <AppLayout />;
}

export default function App() {
  const { taskManagerOpen, setTaskManagerOpen, exportModalOpen, setExportModalOpen } = useAppStore();

  return (
    <ErrorBoundary>
      <AppContent />
      <SearchModal />
      <CreateNotebookModal />
      <ConfirmModal />
      <SettingsModal />
      <GraphViewModal />
      <TaskManagerModal isOpen={taskManagerOpen} onClose={() => setTaskManagerOpen(false)} />
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <Toasts />
    </ErrorBoundary>
  );
}
