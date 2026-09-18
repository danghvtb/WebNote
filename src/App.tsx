// ============================================================
// MyNotes — Main App Component
// Root component: handles auth state and renders appropriate view.
// Pull-first sync guard ensures cloud data is loaded before UI.
// ============================================================

import { lazy, Suspense, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { LoginPage } from './components/auth/LoginPage';
import { CreateFolderPrompt } from './components/auth/CreateFolderPrompt';
import { SyncLoadingScreen } from './components/auth/SyncLoadingScreen';
import { Toasts } from './components/common/Toasts';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { initNetworkListeners, onSyncStatusChange } from './services/sync/syncManager';

import { useNotesStore } from './stores/notesStore';

const GraphViewModal = lazy(() => import('./components/modal/GraphViewModal').then((module) => ({ default: module.GraphViewModal })));
const AppLayout = lazy(() => import('./components/layout/AppLayout').then((module) => ({ default: module.AppLayout })));
const SearchModal = lazy(() => import('./components/search/SearchModal').then((module) => ({ default: module.SearchModal })));
const CreateNotebookModal = lazy(() => import('./components/modal/CreateNotebookModal').then((module) => ({ default: module.CreateNotebookModal })));
const ConfirmModal = lazy(() => import('./components/modal/ConfirmModal').then((module) => ({ default: module.ConfirmModal })));
const SettingsModal = lazy(() => import('./components/settings/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const TaskManagerModal = lazy(() => import('./components/modal/TaskManagerModal').then((module) => ({ default: module.TaskManagerModal })));
const ExportModal = lazy(() => import('./components/modal/ExportModal').then((module) => ({ default: module.ExportModal })));
const TrashModal = lazy(() => import('./components/modal/TrashModal').then((module) => ({ default: module.TrashModal })));
const TagManagerModal = lazy(() => import('./components/modal/TagManagerModal').then((module) => ({ default: module.TagManagerModal })));
const ProjectManagerModal = lazy(() => import('./components/modal/ProjectManagerModal').then((module) => ({ default: module.ProjectManagerModal })));

// Sync timeout — background pull must never block local-first editing
const SYNC_TIMEOUT_MS = 30_000;

function AppContent() {
  const {
    isLoggedIn, needsFolderCreation, setSyncStatus, setLastSyncTime, setTheme,
    setAuth, setRootFolderId, setInitialized, addNotification,
    initialSyncComplete, initialSyncMessage,
    setInitialSyncComplete, setInitialSyncMessage,
    setLocalHydrationStatus, setCloudBootstrapStatus, setPushAllowed,
  } = useAppStore();
  const loadTags = useNotesStore((s) => s.loadTags);
  const loadDays = useNotesStore((s) => s.loadDays);
  const loadRecentNotebooks = useNotesStore((s) => s.loadRecentNotebooks);

  useEffect(() => { if (isLoggedIn && initialSyncComplete) loadTags(); }, [isLoggedIn, initialSyncComplete, loadTags]);

  // ─── Session restore: sequential pull-first sync ───
  useEffect(() => {
    const savedUserStr = localStorage.getItem('mynotes_user');
    const savedToken = localStorage.getItem('mynotes_token');
    const savedExpiry = Number(localStorage.getItem('mynotes_token_expiry') || 0);
    let savedFolder: string | null = null;
    try {
      const savedEmail = savedUserStr ? (JSON.parse(savedUserStr) as { email?: string }).email : '';
      if (savedEmail) savedFolder = localStorage.getItem(`mynotes_root_folder:${savedEmail.toLowerCase()}`);
    } catch {
      savedFolder = null;
    }

    if (!savedUserStr) return;

    let syncTimedOut = false;

    const restoreSession = async () => {
      try {
        const savedUser = JSON.parse(savedUserStr);
        const hasValidToken = Boolean(savedToken && (!savedExpiry || Date.now() < savedExpiry));
        localStorage.setItem('mynotes_cloud_bootstrap_pending', '1');
        setLocalHydrationStatus('loading');
        if (typeof performance !== 'undefined') performance.mark('mynotes:local-hydrate-start');
        setAuth(savedUser, hasValidToken ? savedToken : null);

        // Read IndexedDB before loading GIS/Drive. The cached vault is the
        // first usable UI and remains editable while cloud bootstrap runs.
        // Hydrate independent timeline slices in parallel so cached content
        // reaches the first render without waiting on sequential reads.
        await Promise.all([loadDays(), loadRecentNotebooks()]);
        setLocalHydrationStatus(useNotesStore.getState().days.length > 0 ? 'ready' : 'empty');
        if (typeof performance !== 'undefined') performance.mark('mynotes:local-hydrate-end');

        if (savedFolder) {
          setRootFolderId(savedFolder);
        }

        // Restore the local session immediately. Drive synchronization is
        // deliberately non-blocking so an expired token never traps the user
        // behind a loading screen.
        setInitialSyncComplete(true);
        setInitialSyncMessage('');
        setInitialized(true);
        if (typeof performance !== 'undefined') {
          performance.mark('mynotes:first-local-content');
          try { performance.measure('mynotes:time-to-local-content', 'mynotes:local-hydrate-start', 'mynotes:first-local-content'); } catch { /* optional performance API */ }
        }

        if (!hasValidToken) {
          setCloudBootstrapStatus('auth_required');
          setPushAllowed(false);
          setSyncStatus('auth_required', 'Phiên Google Drive cần được kết nối lại.');
          try {
            const { useScheduleStore } = await import('./stores/scheduleStore');
            const scheduleStore = useScheduleStore.getState();
            await scheduleStore.loadAllBlocks();
            await scheduleStore.loadTasksAndCategories();
          } catch (err) {
            console.warn('[App] Schedule store load error:', err);
          }
          return;
        }

        // Google Drive pull runs in the background while the local vault is usable.
        const timeoutId = setTimeout(() => {
          syncTimedOut = true;
          console.warn('[App] Background sync timeout reached — keeping local data available.');
          addNotification('warning', 'Đồng bộ mất quá lâu. Dữ liệu local vẫn sẵn sàng.');
        }, SYNC_TIMEOUT_MS);

        if (!syncTimedOut) {
          try {
            setInitialSyncMessage('Đang kết nối Google Drive...');
            const { initGoogleAuth, ensureAccessToken } = await import('./services/google/auth');
            await initGoogleAuth();
            await ensureAccessToken();

            setInitialSyncMessage('Đang kiểm tra thư mục MyNotes...');
            const { ensureRootFolder } = await import('./services/google/rootFolderManager');
            const res = await ensureRootFolder();

            if (res.status === 'found') {
              setRootFolderId(res.folderId);

              setInitialSyncMessage('Đang tải dữ liệu từ Google Drive...');
              const { syncFromCloud } = await import('./services/sync/syncBootstrap');
              await syncFromCloud({ isConnectOrLogin: true });
            } else {
              // No folder or error — enable push, user starts fresh
              const { markInitialPullComplete } = await import('./services/sync/syncBootstrap');
              markInitialPullComplete();
              setPushAllowed(true);
            }
          } catch (err) {
            console.warn('[App] Google Drive session restore error:', err);
            setCloudBootstrapStatus('error');
            setPushAllowed(false);
          }
        }

        // ── Finalize background pull ──
        clearTimeout(timeoutId);
        setInitialSyncComplete(true);
        setInitialSyncMessage('');
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
        setLocalHydrationStatus('error');
        setInitialSyncComplete(true);
        setInitialSyncMessage('');
      }
    };

    restoreSession();
  }, [setAuth, setRootFolderId, setInitialized, setInitialSyncComplete, setInitialSyncMessage, setSyncStatus, addNotification, loadDays, loadRecentNotebooks, setLocalHydrationStatus, setCloudBootstrapStatus, setPushAllowed]);

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

  // Surface a safe update prompt instead of reloading while an editor is open.
  useEffect(() => {
    const showUpdate = () => {
      addNotification('info', 'Đã có phiên bản WebNote mới.', {
        label: 'Cập nhật',
        onClick: () => {
          navigator.serviceWorker?.getRegistration().then((registration) => {
            registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(() => window.location.reload(), 250);
          });
        },
      }, 120000);
    };
    window.addEventListener('mynotes_sw_update', showUpdate);
    return () => window.removeEventListener('mynotes_sw_update', showUpdate);
  }, [addNotification]);

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
    let monitorTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextCheck = (delay = 60_000) => {
      if (monitorTimer) clearTimeout(monitorTimer);
      monitorTimer = setTimeout(() => { void checkUpcomingDeadlines(); }, Math.max(10_000, Math.min(delay, 60_000)));
    };

    const checkUpcomingDeadlines = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const { getAllVaultPages, getAllVaultNotebooks } = await import('./services/database/repositoryBootstrap');
        const { parseAllTasks, isValidDueDate } = await import('./utils/taskMonitor');
        const { areSoundNotificationsEnabled, playNotificationChime, sendNativeNotification } = await import('./services/notification/notificationManager');

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
            const msg = `⏰ CẢNH BÁO HẠN: Công việc "${t.text.slice(0, 45)}" còn ${remainingMins} phút nữa là đến hạn!`;

            // 1. Toast Notification inside app
            addNotification('warning', msg);

            // 2. Play soft audio chime
            if (areSoundNotificationsEnabled()) playNotificationChime();

            // 3. Native OS Push Notification
            sendNativeNotification('⏰ WebNote - Cảnh báo hạn!', {
              body: msg,
              tag: `task-deadline-${t.id}`,
            });
          }
        });
        const dueTimes = tasks.map((task) => task.dueDate ? new Date(task.dueDate.includes('T') ? task.dueDate : `${task.dueDate}T18:00`).getTime() - now : Infinity).filter((value) => value > 0);
        scheduleNextCheck(dueTimes.length ? Math.min(...dueTimes, 60_000) : 60_000);
      } catch (err) {
        console.warn('[App] Deadline monitor error:', err);
        scheduleNextCheck();
      }
    };

    // Initial check
    checkUpcomingDeadlines();

    // Re-check at most every minute, or sooner when the next deadline is near.
    scheduleNextCheck();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkUpcomingDeadlines();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (monitorTimer) clearTimeout(monitorTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
  const { taskManagerOpen, setTaskManagerOpen, exportModalOpen, setExportModalOpen, tagManagerOpen, setTagManagerOpen, projectManagerOpen, setProjectManagerOpen, graphViewOpen, trashModalOpen, searchOpen, createNotebookOpen, confirmModal, settingsOpen } = useAppStore();

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <AppContent />
        {searchOpen && <SearchModal />}
        {createNotebookOpen && <CreateNotebookModal />}
        {confirmModal.open && <ConfirmModal />}
        {settingsOpen && <SettingsModal />}
        {graphViewOpen && <GraphViewModal />}
        {taskManagerOpen && <TaskManagerModal isOpen onClose={() => setTaskManagerOpen(false)} />}
        {exportModalOpen && <ExportModal isOpen onClose={() => setExportModalOpen(false)} />}
        {trashModalOpen && <TrashModal />}
        {tagManagerOpen && <TagManagerModal isOpen onClose={() => setTagManagerOpen(false)} />}
        {projectManagerOpen && <ProjectManagerModal isOpen onClose={() => setProjectManagerOpen(false)} />}
        <Toasts />
      </Suspense>
    </ErrorBoundary>
  );
}
