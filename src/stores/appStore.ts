// ============================================================
// MyNotes — App Store (Zustand)
// Global application state: auth, sync, UI preferences.
// ============================================================

import { create } from 'zustand';
import type {
  GoogleUser,
  SyncStatus,
  AppTheme,
  Notification,
  TimelineGroupingMode,
} from '../types';

interface AppState {
  // Auth
  isLoggedIn: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  authLoading: boolean;
  authError: string | null;

  // Sync
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  syncMessage: string | null;

  // UI
  theme: AppTheme;
  searchOpen: boolean;
  searchQuery: string;
  settingsOpen: boolean;
  createNotebookOpen: boolean;
  graphViewOpen: boolean;
  taskManagerOpen: boolean;
  exportModalOpen: boolean;
  tagManagerOpen: boolean;
  projectManagerOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileDaySidebarOpen: boolean;
  timelineGroupingMode: TimelineGroupingMode;
  expandedTimelineGroupKeys: Record<TimelineGroupingMode, string[]>;
  confirmModal: { open: boolean; title: string; message: string; onConfirm: (() => void) | null };

  // App state
  initialized: boolean;
  rootFolderId: string | null;
  needsFolderCreation: boolean;

  // Sync guard — blocks UI & push until initial cloud pull finishes
  initialSyncComplete: boolean;
  initialSyncMessage: string;
  localHydrationStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  cloudBootstrapStatus: 'idle' | 'auth_required' | 'checking' | 'downloading' | 'applying' | 'ready' | 'offline' | 'error';
  searchIndexStatus: 'ready' | 'building' | 'error';
  pushAllowed: boolean;

  // Notifications
  notifications: Notification[];

  // Actions
  setAuth: (user: GoogleUser | null, token: string | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  logout: () => void;
  setSyncStatus: (status: SyncStatus, message?: string | null) => void;
  setLastSyncTime: (time: string | null) => void;
  setTheme: (theme: AppTheme) => void;
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setCreateNotebookOpen: (open: boolean) => void;
  setGraphViewOpen: (open: boolean) => void;
  setTaskManagerOpen: (open: boolean) => void;
  setExportModalOpen: (open: boolean) => void;
  setTagManagerOpen: (open: boolean) => void;
  setProjectManagerOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setMobileDaySidebarOpen: (open: boolean) => void;
  setTimelineGroupingMode: (mode: TimelineGroupingMode) => void;
  toggleTimelineGroup: (mode: TimelineGroupingMode, key: string) => void;
  ensureTimelineGroupsExpanded: (mode: TimelineGroupingMode, keys: string[]) => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: (() => void) | null }) => void;
  setInitialized: (initialized: boolean) => void;
  setRootFolderId: (folderId: string | null) => void;
  setNeedsFolderCreation: (needs: boolean) => void;
  setInitialSyncComplete: (done: boolean) => void;
  setInitialSyncMessage: (msg: string) => void;
  setLocalHydrationStatus: (status: AppState['localHydrationStatus']) => void;
  setCloudBootstrapStatus: (status: AppState['cloudBootstrapStatus']) => void;
  setSearchIndexStatus: (status: AppState['searchIndexStatus']) => void;
  setPushAllowed: (allowed: boolean) => void;
  trashModalOpen: boolean;
  setTrashModalOpen: (open: boolean) => void;
  addNotification: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    action?: { label: string; onClick: () => void },
    duration?: number
  ) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isLoggedIn: false,
  user: null,
  accessToken: null,
  authLoading: false,
  authError: null,

  syncStatus: 'idle',
  lastSyncTime: null,
  syncMessage: null,

  theme: 'dark',
  searchOpen: false,
  searchQuery: '',
  settingsOpen: false,
  createNotebookOpen: false,
  graphViewOpen: false,
  taskManagerOpen: false,
  exportModalOpen: false,
  tagManagerOpen: false,
  projectManagerOpen: false,
  mobileSidebarOpen: false,
  mobileDaySidebarOpen: false,
  timelineGroupingMode: 'week',
  expandedTimelineGroupKeys: { week: [], month: [] },
  confirmModal: { open: false, title: '', message: '', onConfirm: null },

  initialized: false,
  rootFolderId: null,
  needsFolderCreation: false,

  initialSyncComplete: false,
  initialSyncMessage: '',
  localHydrationStatus: 'idle',
  cloudBootstrapStatus: 'idle',
  searchIndexStatus: 'ready',
  pushAllowed: false,

  notifications: [],

  // Actions
  setAuth: (user, token) => {
    if (user) {
      localStorage.setItem('mynotes_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mynotes_user');
    }
    if (token) {
      localStorage.setItem('mynotes_token', token);
    } else {
      localStorage.removeItem('mynotes_token');
      localStorage.removeItem('mynotes_token_expiry');
    }
    set({ isLoggedIn: !!user, user, accessToken: token, authError: null });
  },

  setAuthLoading: (loading) => set({ authLoading: loading }),

  setAuthError: (error) => set({ authError: error, authLoading: false }),

  logout: () => {
    let accountRootKey: string | null = null;
    try {
      const rawUser = localStorage.getItem('mynotes_user');
      const email = rawUser ? (JSON.parse(rawUser) as { email?: string }).email : '';
      if (email) accountRootKey = `mynotes_root_folder:${email.toLowerCase()}`;
    } catch {
      // Ignore malformed legacy session data.
    }
    localStorage.removeItem('mynotes_user');
    localStorage.removeItem('mynotes_token');
    localStorage.removeItem('mynotes_token_expiry');
    localStorage.removeItem('mynotes_root_folder');
    localStorage.removeItem('mynotes_rootFolderId');
    if (accountRootKey) localStorage.removeItem(accountRootKey);
    // Reset sync guard so next login does a fresh pull
    import('../services/sync/syncReset').then(({ resetInitialPullState }) => {
      resetInitialPullState();
    });
    import('../services/google/rootFolderManager').then(({ clearRootFolderCache }) => {
      clearRootFolderCache().catch(() => undefined);
    });
    set({
      isLoggedIn: false,
      user: null,
      accessToken: null,
      initialized: false,
      rootFolderId: null,
      needsFolderCreation: false,
      initialSyncComplete: false,
      initialSyncMessage: '',
      localHydrationStatus: 'idle',
      cloudBootstrapStatus: 'idle',
      pushAllowed: false,
    });
  },

  setSyncStatus: (status, message = null) =>
    set({ syncStatus: status, syncMessage: message }),

  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  setTheme: (theme) => {
    // Apply theme to document
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('mynotes_theme', theme);
    set({ theme });
  },

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen, searchQuery: '' })),
  setSearchOpen: (open) => set({ searchOpen: open, searchQuery: open ? '' : '' }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCreateNotebookOpen: (open) => set({ createNotebookOpen: open }),
  setGraphViewOpen: (open) => set({ graphViewOpen: open }),
  setTaskManagerOpen: (open) => set({ taskManagerOpen: open }),
  setExportModalOpen: (open) => set({ exportModalOpen: open }),
  setTagManagerOpen: (open) => set({ tagManagerOpen: open }),
  setProjectManagerOpen: (open) => set({ projectManagerOpen: open }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setMobileDaySidebarOpen: (open) => set({ mobileDaySidebarOpen: open }),
  setTimelineGroupingMode: (mode) => set({ timelineGroupingMode: mode }),
  toggleTimelineGroup: (mode, key) =>
    set((state) => {
      const currentKeys = state.expandedTimelineGroupKeys[mode];
      const nextKeys = currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key];

      return {
        expandedTimelineGroupKeys: {
          ...state.expandedTimelineGroupKeys,
          [mode]: nextKeys,
        },
      };
    }),
  ensureTimelineGroupsExpanded: (mode, keys) =>
    set((state) => {
      const currentKeys = state.expandedTimelineGroupKeys[mode];
      const nextKeys = Array.from(new Set([...currentKeys, ...keys]));
      if (nextKeys.length === currentKeys.length) return state;

      return {
        expandedTimelineGroupKeys: {
          ...state.expandedTimelineGroupKeys,
          [mode]: nextKeys,
        },
      };
    }),
  setConfirmModal: (modal) => set({ confirmModal: modal }),
  setInitialized: (initialized) => set({ initialized }),
  setRootFolderId: (folderId) => {
    if (folderId) {
      localStorage.setItem('mynotes_root_folder', folderId);
    } else {
      localStorage.removeItem('mynotes_root_folder');
    }
    set({ rootFolderId: folderId });
  },
  setNeedsFolderCreation: (needs) => set({ needsFolderCreation: needs }),
  setInitialSyncComplete: (done) => set({ initialSyncComplete: done }),
  setInitialSyncMessage: (msg) => set({ initialSyncMessage: msg }),
  setLocalHydrationStatus: (status) => set({ localHydrationStatus: status }),
  setCloudBootstrapStatus: (status) => set({ cloudBootstrapStatus: status }),
  setSearchIndexStatus: (status) => set({ searchIndexStatus: status }),
  setPushAllowed: (allowed) => set({ pushAllowed: allowed }),

  trashModalOpen: false,
  setTrashModalOpen: (open) => set({ trashModalOpen: open }),

  addNotification: (type, message, action, duration = 5000) => {
    const id = crypto.randomUUID();
    set((s) => ({
      notifications: [...s.notifications, { id, type, message, action, duration }],
    }));
    // Auto-remove after specified duration
    setTimeout(() => {
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      }));
    }, duration);
  },

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
