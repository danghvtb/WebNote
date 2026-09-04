// ============================================================
// MyNotes — Keyboard Shortcuts Hook
// Global keyboard shortcut handler.
// ============================================================

import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useNotesStore } from '../stores/notesStore';
import { forceSync } from '../services/sync/syncManager';

export function useKeyboardShortcuts() {
  const { toggleSearch, setCreateNotebookOpen, isLoggedIn } = useAppStore();
  const { createPage, selectedNotebookId } = useNotesStore();

  useEffect(() => {
    if (!isLoggedIn) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+K — Search
      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
        return;
      }

      // Ctrl+N — New Notebook
      if (isCtrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setCreateNotebookOpen(true);
        return;
      }

      // Ctrl+Shift+N — New Page
      if (isCtrl && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        if (selectedNotebookId) {
          createPage(selectedNotebookId, 'Untitled');
        }
        return;
      }

      // Ctrl+S — Force sync
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        forceSync();
        return;
      }

      // Escape — close modals (handled individually by modals)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoggedIn, toggleSearch, setCreateNotebookOpen, createPage, selectedNotebookId]);
}
