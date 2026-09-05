// ============================================================
// MyNotes — App Store (Zustand)
// Global application state: auth, sync, UI preferences.
// ============================================================

import { create } from 'zustand';
import type { GoogleUser, SyncStatus, AppTheme } from '../types';

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
  mobileSidebarOpen: boolean;
  mobileDaySidebarOpen: boolean;
  confirmModal: { open: boolean; title: string; message: string; onConfirm: (() => void) | null };

  // App state
  initialized: boolean;
  rootFolderId: string | null;
  needsFolderCreation: boolean;

  // Notifications
  notifications: { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }[];

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
  setMobileSidebarOpen: (open: boolean) => void;
  setMobileDaySidebarOpen: (open: boolean) => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: (() => void) | null }) => void;
  setInitialized: (initialized: boolean) => void;
  setRootFolderId: (folderId: string | null) => void;
  setNeedsFolderCreation: (needs: boolean) => void;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
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
  mobileSidebarOpen: false,
  mobileDaySidebarOpen: false,
  confirmModal: { open: false, title: '', message: '', onConfirm: null },

  initialized: false,
  rootFolderId: null,
  needsFolderCreation: false,

  notifications: [],

  // Actions
  setAuth: (user, token) =>
    set({ isLoggedIn: !!user, user, accessToken: token, authError: null }),

  setAuthLoading: (loading) => set({ authLoading: loading }),

  setAuthError: (error) => set({ authError: error, authLoading: false }),

  logout: () =>
    set({
      isLoggedIn: false,
      user: null,
      accessToken: null,
      initialized: false,
      rootFolderId: null,
    }),

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
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setMobileDaySidebarOpen: (open) => set({ mobileDaySidebarOpen: open }),
  setConfirmModal: (modal) => set({ confirmModal: modal }),
  setInitialized: (initialized) => set({ initialized }),
  setRootFolderId: (folderId) => set({ rootFolderId: folderId }),
  setNeedsFolderCreation: (needs) => set({ needsFolderCreation: needs }),

  addNotification: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({
      notifications: [...s.notifications, { id, type, message }],
    }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      }));
    }, 5000);
  },

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
