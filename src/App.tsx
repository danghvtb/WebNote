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

function AppContent() {
  const { isLoggedIn, needsFolderCreation, setSyncStatus, setLastSyncTime, setTheme } = useAppStore();

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
  return (
    <ErrorBoundary>
      <AppContent />
      <SearchModal />
      <CreateNotebookModal />
      <ConfirmModal />
      <SettingsModal />
      <Toasts />
    </ErrorBoundary>
  );
}
