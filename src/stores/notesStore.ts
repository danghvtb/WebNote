// ============================================================
// MyNotes — Notes Store (Zustand)
// State for Days, Notebooks, Pages navigation and data.
// ============================================================

import { create } from 'zustand';
import type { Day, Notebook, Page } from '../types';
import * as repo from '../services/database/repository';

interface NotesState {
  // Data
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  recentNotebooks: Notebook[];

  // Selection
  selectedDayId: string | null;
  selectedNotebookId: string | null;
  selectedPageId: string | null;

  // Loading
  daysLoading: boolean;
  notebooksLoading: boolean;
  pagesLoading: boolean;

  // Mobile UI
  mobileView: 'days' | 'notebooks' | 'editor';

  // Actions — Data Loading
  loadDays: () => Promise<void>;
  loadNotebooksByDay: (dayId: string) => Promise<void>;
  loadPagesByNotebook: (notebookId: string) => Promise<void>;
  loadRecentNotebooks: () => Promise<void>;

  // Actions — Selection
  selectDay: (dayId: string) => void;
  selectNotebook: (notebookId: string) => Promise<void>;
  selectPage: (pageId: string) => void;
  selectToday: () => Promise<void>;

  // Actions — CRUD
  createNotebook: (title: string, dayId?: string) => Promise<Notebook>;
  updateNotebook: (id: string, updates: Partial<Pick<Notebook, 'title' | 'icon'>>) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  duplicateNotebook: (id: string) => Promise<void>;

  createPage: (notebookId: string, title?: string) => Promise<Page>;
  updatePageContent: (pageId: string, content: string) => Promise<void>;
  updatePageTitle: (pageId: string, title: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  reorderPages: (notebookId: string, pageIds: string[]) => Promise<void>;

  // Actions — Mobile
  setMobileView: (view: 'days' | 'notebooks' | 'editor') => void;

  // Reset
  resetSelection: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  // Initial state
  days: [],
  notebooks: [],
  pages: [],
  recentNotebooks: [],

  selectedDayId: null,
  selectedNotebookId: null,
  selectedPageId: null,

  daysLoading: false,
  notebooksLoading: false,
  pagesLoading: false,

  mobileView: 'days',

  // ── Data Loading ──

  loadDays: async () => {
    set({ daysLoading: true });
    try {
      const days = await repo.getAllDays();
      set({ days, daysLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load days:', error);
      set({ daysLoading: false });
    }
  },

  loadNotebooksByDay: async (dayId: string) => {
    set({ notebooksLoading: true });
    try {
      const notebooks = await repo.getNotebooksByDay(dayId);
      set({ notebooks, notebooksLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load notebooks:', error);
      set({ notebooksLoading: false });
    }
  },

  loadPagesByNotebook: async (notebookId: string) => {
    set({ pagesLoading: true });
    try {
      const pages = await repo.getPagesByNotebook(notebookId);
      set({ pages, pagesLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load pages:', error);
      set({ pagesLoading: false });
    }
  },

  loadRecentNotebooks: async () => {
    try {
      const recent = await repo.getRecentNotebooks(10);
      set({ recentNotebooks: recent });
    } catch (error) {
      console.error('[NotesStore] Failed to load recent:', error);
    }
  },

  // ── Selection ──

  selectDay: (dayId) => {
    set({
      selectedDayId: dayId,
      selectedNotebookId: null,
      selectedPageId: null,
      notebooks: [],
      pages: [],
    });
    get().loadNotebooksByDay(dayId);
  },

  selectNotebook: async (notebookId) => {
    set({
      selectedNotebookId: notebookId,
      selectedPageId: null,
      pages: [],
    });
    await get().loadPagesByNotebook(notebookId);

    // Auto-select first page
    const { pages } = get();
    if (pages.length > 0) {
      set({ selectedPageId: pages[0].id });
    }
  },

  selectPage: (pageId) => {
    set({ selectedPageId: pageId });
  },

  selectToday: async () => {
    const today = await repo.ensureToday();
    get().selectDay(today.id);
    await get().loadDays(); // Refresh days list
  },

  // ── CRUD — Notebooks ──

  createNotebook: async (title, dayId) => {
    const targetDayId = dayId || get().selectedDayId;
    if (!targetDayId) {
      // Create for today
      await repo.ensureToday();
    }

    const notebook = await repo.createNotebook(title, targetDayId || undefined);

    // Refresh
    await get().loadDays();
    if (get().selectedDayId === notebook.dateId) {
      await get().loadNotebooksByDay(notebook.dateId);
    }
    await get().loadRecentNotebooks();

    return notebook;
  },

  updateNotebook: async (id, updates) => {
    await repo.updateNotebook(id, updates);
    const { selectedDayId } = get();
    if (selectedDayId) {
      await get().loadNotebooksByDay(selectedDayId);
    }
    await get().loadRecentNotebooks();
  },

  deleteNotebook: async (id) => {
    const { selectedNotebookId, selectedDayId } = get();
    await repo.deleteNotebook(id);

    if (selectedNotebookId === id) {
      set({ selectedNotebookId: null, selectedPageId: null, pages: [] });
    }
    if (selectedDayId) {
      await get().loadNotebooksByDay(selectedDayId);
    }
    await get().loadDays();
    await get().loadRecentNotebooks();
  },

  duplicateNotebook: async (id) => {
    await repo.duplicateNotebook(id);
    const { selectedDayId } = get();
    if (selectedDayId) {
      await get().loadNotebooksByDay(selectedDayId);
    }
    await get().loadRecentNotebooks();
  },

  // ── CRUD — Pages ──

  createPage: async (notebookId, title = 'Untitled') => {
    const page = await repo.createPage(notebookId, title);
    await get().loadPagesByNotebook(notebookId);
    set({ selectedPageId: page.id });
    return page;
  },

  updatePageContent: async (pageId, content) => {
    await repo.updatePageContent(pageId, content);
    // Don't reload all pages, just update the specific one in state
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, content, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  updatePageTitle: async (pageId, title) => {
    await repo.updatePageTitle(pageId, title);
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, title, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  deletePage: async (pageId) => {
    const { selectedPageId, selectedNotebookId, pages } = get();
    await repo.deletePage(pageId);

    if (selectedPageId === pageId) {
      const remainingPages = pages.filter((p) => p.id !== pageId);
      set({ selectedPageId: remainingPages.length > 0 ? remainingPages[0].id : null });
    }

    if (selectedNotebookId) {
      await get().loadPagesByNotebook(selectedNotebookId);
    }
  },

  reorderPages: async (notebookId, pageIds) => {
    await repo.reorderPages(notebookId, pageIds);
    await get().loadPagesByNotebook(notebookId);
  },

  // ── Mobile ──

  setMobileView: (view) => set({ mobileView: view }),

  // ── Reset ──

  resetSelection: () =>
    set({
      selectedDayId: null,
      selectedNotebookId: null,
      selectedPageId: null,
      days: [],
      notebooks: [],
      pages: [],
    }),
}));
