// ============================================================
// MyNotes — Main App Component
// Root component: handles auth state and renders appropriate view.
// Pull-first sync guard ensures cloud data is loaded before UI.
// ============================================================

import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { LoginPage } from './components/auth/LoginPage';
import { CreateFolderPrompt } from './components/auth/CreateFolderPrompt';
import { SyncLoadingScreen } from './components/auth/SyncLoadingScreen';
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

// Sync timeout — 30 seconds max wait before allowing user in
const SYNC_TIMEOUT_MS = 30_000;

function AppContent() {
  const {
    isLoggedIn, needsFolderCreation, setSyncStatus, setLastSyncTime, setTheme,
    setAuth, setRootFolderId, setInitialized, addNotification,
    initialSyncComplete, initialSyncMessage,
    setInitialSyncComplete, setInitialSyncMessage,
  } = useAppStore();

  // ─── Session restore: sequential pull-first sync ───
  useEffect(() => {
    const savedUserStr = localStorage.getItem('mynotes_user');
    const savedToken = localStorage.getItem('mynotes_token');
    const savedFolder = localStorage.getItem('mynotes_root_folder');

    if (!savedUserStr) return;

    let syncTimedOut = false;

    const restoreSession = async () => {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setAuth(savedUser, savedToken);

        if (savedFolder) {
          setRootFolderId(savedFolder);
        }

        // Mark as logged in but NOT sync complete yet — show loading screen
        setInitialSyncComplete(false);
        setInitialSyncMessage('Đang khôi phục phiên đăng nhập...');
        setInitialized(true);

        // Pre-import for use in sync timeout callback
        const { markInitialPullComplete: unlockPull } = await import('./services/sync/syncManager');

        // ── Safety timeout: auto-unlock after SYNC_TIMEOUT_MS ──
        const timeoutId = setTimeout(() => {
          syncTimedOut = true;
          console.warn('[App] Sync timeout reached — unlocking UI with local data.');
          unlockPull();
          setInitialSyncComplete(true);
          addNotification('warning', 'Đồng bộ mất quá lâu. Dữ liệu có thể chưa được cập nhật đầy đủ.');
        }, SYNC_TIMEOUT_MS);

        // ── Step 1: Try Supabase sync first ──
        let supabaseSynced = false;
        try {
          const { supabase, isSupabaseConfigured } = await import('./services/supabase/supabaseClient');
          if (isSupabaseConfigured() && supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setInitialSyncMessage('Đang tải dữ liệu từ Supabase...');
              const { syncFromSupabase } = await import('./services/supabase/supabaseSync');
              await syncFromSupabase({ isConnectOrLogin: true });
              supabaseSynced = true;
            }
          }
        } catch (err) {
          console.warn('[App] Supabase session restore:', err);
        }

        // ── Step 2: Google Drive sync (if Supabase didn't handle it) ──
        if (!supabaseSynced && !syncTimedOut) {
          try {
            setInitialSyncMessage('Đang kết nối Google Drive...');
            const { initGoogleAuth, ensureAccessToken } = await import('./services/google/auth');
            await initGoogleAuth();
            await ensureAccessToken().catch((err) => {
              console.warn('[App] Silent token restore failed:', err);
            });

            setInitialSyncMessage('Đang kiểm tra thư mục MyNotes...');
            const { ensureRootFolder } = await import('./services/google/rootFolderManager');
            const res = await ensureRootFolder();

            if (res.status === 'found') {
              setRootFolderId(res.folderId);

              setInitialSyncMessage('Đang tải dữ liệu từ Google Drive...');
              const { syncFromCloud } = await import('./services/sync/syncManager');
              await syncFromCloud({ isConnectOrLogin: true });
            } else {
              // No folder or error — enable push, user starts fresh
              const { markInitialPullComplete } = await import('./services/sync/syncManager');
              markInitialPullComplete();
            }
          } catch (err) {
            console.warn('[App] Google Drive session restore error:', err);
            // Enable push on error so app doesn't deadlock
            const { markInitialPullComplete } = await import('./services/sync/syncManager');
            markInitialPullComplete();
          }
        }

        // ── Clear timeout & finalize ──
        clearTimeout(timeoutId);

        if (!syncTimedOut) {
          setInitialSyncComplete(true);
          setInitialSyncMessage('');
        }

        // Load schedule data into stores after sync
        try {
          const { useScheduleStore } = await import('./stores/scheduleStore');
          const scheduleStore = useScheduleStore.getState();
          await scheduleStore.loadAllBlocks();
          await scheduleStore.loadTasksAndCategories();
        } catch (err) {
          console.warn('[App] Schedule store load error:', err);
        }
      } catch (err) {
        console.warn('[App] Session restore error:', err);
        setInitialSyncComplete(true);
        setInitialSyncMessage('');
      }
    };

    restoreSession();
  }, [setAuth, setRootFolderId, setInitialized, setInitialSyncComplete, setInitialSyncMessage, addNotification]);

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

  // Listen to sync status changes & Auth expiration events
  useEffect(() => {
    const unsubscribe = onSyncStatusChange((status, message) => {
      setSyncStatus(status, message);
      if (status === 'saved') {
        setLastSyncTime(new Date().toISOString());
      }
    });

    const handleAuthRequired = () => {
      setSyncStatus('auth_required', 'Phiên đăng nhập đã hết hạn. Vui lòng bấm Kết nối lại.');
      addNotification(
        'warning',
        'Phiên đồng bộ Google Drive đã hết hạn. Vui lòng bấm "Kết nối lại Drive" ở thanh trên cùng.'
      );
    };

    window.addEventListener('mynotes_auth_required', handleAuthRequired);

    return () => {
      unsubscribe();
      window.removeEventListener('mynotes_auth_required', handleAuthRequired);
    };
  }, [setSyncStatus, setLastSyncTime, addNotification]);

  // 30-Minute Deadline Warning Monitor & Native Push + Audio Chime
  useEffect(() => {
    const alertedTaskIds = new Set<string>();

    // Request Notification Permission on App init
    import('./services/notification/notificationManager').then(({ requestNotificationPermission }) => {
      requestNotificationPermission();
    });

    const checkUpcomingDeadlines = async () => {
      try {
        const { getAllVaultPages, getAllVaultNotebooks } = await import('./services/database/repository');
        const { parseAllTasks, isValidDueDate } = await import('./utils/taskUtils');
        const { playNotificationChime, sendNativeNotification } = await import('./services/notification/notificationManager');

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
            const msg = `⏰ CẢNH BÁO DEADLINE: Task "${t.text.slice(0, 45)}" còn ${remainingMins} phút nữa là đến hạn!`;

            // 1. Toast Notification inside app
            addNotification('warning', msg);

            // 2. Play soft audio chime
            playNotificationChime();

            // 3. Native OS Push Notification
            sendNativeNotification('⏰ MyNotes - Cảnh Báo Deadline!', {
              body: msg,
              tag: `task-deadline-${t.id}`,
            });
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

  // ─── Auth flow routing with sync guard ───
  if (!isLoggedIn) {
    return <LoginPage />;
  }

  // Show loading screen while initial cloud pull is in progress
  if (!initialSyncComplete) {
    return <SyncLoadingScreen message={initialSyncMessage} />;
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
