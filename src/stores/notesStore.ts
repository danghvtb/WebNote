// ============================================================
// MyNotes — Notes Store (Zustand)
// State for Days, Notebooks, Pages navigation and data.
// ============================================================

import { create } from 'zustand';
import type { Day, Notebook, Page, Tag } from '../types';
import * as repo from '../services/database/repository';

// Incremented whenever navigation starts a new data load. IndexedDB queries
// can resolve out of order; these epochs prevent an older response from
// replacing the list belonging to the page/notebook currently being viewed.
let notebooksLoadEpoch = 0;
let pagesLoadEpoch = 0;

interface NotesState {
  // Data
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
  tags: Tag[];
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

  deletedPages: Page[];

  // Actions — Data Loading
  loadDays: () => Promise<void>;
  loadNotebooksByDay: (dayId: string) => Promise<void>;
  loadPagesByNotebook: (notebookId: string) => Promise<void>;
  loadRecentNotebooks: () => Promise<void>;
  loadDeletedPages: () => Promise<void>;
  loadTags: () => Promise<void>;

  // Actions — Selection
  selectDay: (dayId: string) => Promise<void>;
  selectNotebook: (notebookId: string) => Promise<void>;
  selectPage: (pageId: string) => void;
  selectToday: () => Promise<void>;

  // Actions — CRUD
  createNotebook: (title: string, dayId?: string) => Promise<Notebook>;
  updateNotebook: (id: string, updates: Partial<Pick<Notebook, 'title' | 'icon'>>) => Promise<void>;
  setNotebookPinned: (id: string, isPinned: boolean) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  duplicateNotebook: (id: string) => Promise<void>;

  createPage: (notebookId: string, title?: string) => Promise<Page>;
  updatePageContent: (pageId: string, content: string) => Promise<void>;
  updatePageTitle: (pageId: string, title: string) => Promise<void>;
  setPagePinned: (pageId: string, isPinned: boolean) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  restorePage: (pageId: string) => Promise<void>;
  permanentlyDeletePage: (pageId: string) => Promise<void>;
  reorderPages: (notebookId: string, pageIds: string[]) => Promise<void>;
  createTag: (name: string) => Promise<Tag>;
  renameTag: (id: string, name: string) => Promise<void>;
  deleteTag: (id: string) => Promise<string[]>;
  setPageTags: (pageId: string, tagIds: string[]) => Promise<void>;

  // Actions — Mobile
  setMobileView: (view: 'days' | 'notebooks' | 'editor') => void;

  // Reset
  resetSelection: () => void;
  clearPageSelection: () => void;
  clearPageEditorSelection: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  // Initial state
  days: [],
  notebooks: [],
  pages: [],
  tags: [],
  recentNotebooks: [],

  selectedDayId: null,
  selectedNotebookId: null,
  selectedPageId: null,

  daysLoading: false,
  notebooksLoading: false,
  pagesLoading: false,

  mobileView: 'days',

  deletedPages: [],

  // ── Data Loading ──

  loadDays: async () => {
    set({ daysLoading: true });
    try {
      let days = await repo.getAllDays();

      // Do not seed while a cloud snapshot is still being resolved. Otherwise a
      // cold login can create demo records that are accidentally uploaded.
      const cloudBootstrapPending = localStorage.getItem('mynotes_cloud_bootstrap_pending') === '1';
      if (days.length === 0 && !cloudBootstrapPending) {
        const { seedDemoVault } = await import('../services/database/seedDemo');
        const { notebook } = await seedDemoVault();
        days = await repo.getAllDays();
        set({ days, daysLoading: false });
        get().selectDay(notebook.dateId);
        await get().selectNotebook(notebook.id);
        return;
      }

      set({ days, daysLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load days:', error);
      set({ daysLoading: false });
    }
  },

  loadNotebooksByDay: async (dayId: string) => {
    const requestEpoch = ++notebooksLoadEpoch;
    set({ notebooksLoading: true });
    try {
      const notebooks = await repo.getNotebooksByDay(dayId);
      // A user can switch days before the previous IndexedDB query resolves.
      // Never let an older response replace the currently selected day's list.
      if (requestEpoch !== notebooksLoadEpoch || get().selectedDayId !== dayId) return;
      set({ notebooks, notebooksLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load notebooks:', error);
      if (requestEpoch === notebooksLoadEpoch && get().selectedDayId === dayId) set({ notebooksLoading: false });
    }
  },

  loadPagesByNotebook: async (notebookId: string) => {
    const requestEpoch = ++pagesLoadEpoch;
    set({ pagesLoading: true });
    try {
      const pages = await repo.getPagesByNotebook(notebookId);
      // Ignore stale responses when navigation moved to another notebook while
      // this request was in flight. Otherwise selectedPageId can point to a
      // page missing from the rendered list and the editor appears blank.
      if (requestEpoch !== pagesLoadEpoch || get().selectedNotebookId !== notebookId) return;
      set({ pages, pagesLoading: false });
    } catch (error) {
      console.error('[NotesStore] Failed to load pages:', error);
      if (requestEpoch === pagesLoadEpoch && get().selectedNotebookId === notebookId) set({ pagesLoading: false });
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

  loadDeletedPages: async () => {
    try {
      const deleted = await repo.getDeletedPages();
      set({ deletedPages: deleted });
    } catch (error) {
      console.error('[NotesStore] Failed to load deleted pages:', error);
    }
  },

  loadTags: async () => {
    try { set({ tags: await repo.getAllTags() }); } catch (error) { console.error('[NotesStore] Failed to load tags:', error); }
  },

  // ── Selection ──

  selectDay: async (dayId) => {
    // Invalidate any page query started for the previous day immediately.
    pagesLoadEpoch += 1;
    notebooksLoadEpoch += 1;
    set({
      selectedDayId: dayId,
      selectedNotebookId: null,
      selectedPageId: null,
      notebooks: [],
      pages: [],
    });
    await get().loadNotebooksByDay(dayId);
    if (get().selectedDayId !== dayId) return;
    const { notebooks, selectedNotebookId } = get();
    if (notebooks.length > 0 && !selectedNotebookId) {
      await get().selectNotebook(notebooks[0].id);
    }
  },

  selectNotebook: async (notebookId) => {
    pagesLoadEpoch += 1;
    const notebook = await repo.getNotebook(notebookId);
    if (notebook) {
      if (get().selectedDayId !== notebook.dateId) {
        set({ selectedDayId: notebook.dateId });
        await get().loadNotebooksByDay(notebook.dateId);
      }
    }
    set({
      selectedNotebookId: notebookId,
    });
    await get().loadPagesByNotebook(notebookId);

    if (get().selectedNotebookId !== notebookId) return;

    // Auto-select first page if no page selected or selected page not in this notebook
    const { pages, selectedPageId } = get();
    if (pages.length > 0 && (!selectedPageId || !pages.some((p) => p.id === selectedPageId))) {
      set({ selectedPageId: pages[0].id });
    }
  },

  selectPage: async (pageId) => {
    // Invalidate a previous notebook load before resolving this page's parent.
    pagesLoadEpoch += 1;
    set({ selectedPageId: pageId });
    try {
      const page = await repo.getPage(pageId);
      if (page) {
        const notebook = await repo.getNotebook(page.notebookId);
        if (notebook) {
          // The user may have selected another page while the parent lookup was
          // pending. Do not let this stale result change the active notebook.
          if (get().selectedPageId !== pageId) return;
          if (get().selectedDayId !== notebook.dateId) {
            set({ selectedDayId: notebook.dateId });
            await get().loadNotebooksByDay(notebook.dateId);
          }
          if (get().selectedPageId !== pageId) return;
          if (get().selectedNotebookId !== notebook.id) {
            set({ selectedNotebookId: notebook.id });
            await get().loadPagesByNotebook(notebook.id);
          }
        }
      }
    } catch (err) {
      console.error('[NotesStore] Failed to resolve parent notebook for page:', err);
    }
  },

  selectToday: async () => {
    const today = await repo.ensureToday();
    await get().selectDay(today.id);
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

  setNotebookPinned: async (id, isPinned) => {
    const updated = await repo.setNotebookPinned(id, isPinned);
    if (!updated) return;
    set((s) => ({ notebooks: s.notebooks.map((nb) => nb.id === id ? updated : nb) }));
    if (get().selectedDayId) await get().loadNotebooksByDay(get().selectedDayId!);
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
    await get().loadDays();
    if (selectedDayId) {
      await get().loadNotebooksByDay(selectedDayId);
    }
    await get().loadRecentNotebooks();
  },

  // ── CRUD — Pages ──

  createPage: async (notebookId, title = 'Chưa có tiêu đề') => {
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
    const { selectedPageId, pages } = get();

    // 1. Calculate smart adjacent page selection if active page is being deleted
    let nextSelectedPageId: string | null = selectedPageId;
    if (selectedPageId === pageId) {
      const currentIndex = pages.findIndex((p) => p.id === pageId);
      const remainingPages = pages.filter((p) => p.id !== pageId);
      if (remainingPages.length === 0) {
        nextSelectedPageId = null;
      } else if (currentIndex < remainingPages.length) {
        // Next page at same index
        nextSelectedPageId = remainingPages[currentIndex].id;
      } else {
        // Was last page, select previous
        nextSelectedPageId = remainingPages[remainingPages.length - 1].id;
      }
    }

    // 2. Optimistic UI update immediately (no UI stutter)
    set({
      pages: pages.filter((p) => p.id !== pageId),
      selectedPageId: nextSelectedPageId,
    });

    // 3. Perform soft delete in repository
    await repo.deletePage(pageId);

    // 4. Reload deleted pages in background
    get().loadDeletedPages();
  },

  restorePage: async (pageId) => {
    const restored = await repo.restorePage(pageId);
    if (restored) {
      const { selectedNotebookId } = get();
      if (selectedNotebookId === restored.notebookId) {
        await get().loadPagesByNotebook(selectedNotebookId);
      }
      set({ selectedPageId: restored.id });
      get().loadDeletedPages();
    }
  },

  permanentlyDeletePage: async (pageId) => {
    await repo.permanentlyDeletePage(pageId);
    set((s) => ({
      deletedPages: s.deletedPages.filter((p) => p.id !== pageId),
      pages: s.pages.filter((p) => p.id !== pageId),
    }));
    get().loadDeletedPages();
  },

  reorderPages: async (notebookId, pageIds) => {
    await repo.reorderPages(notebookId, pageIds);
    await get().loadPagesByNotebook(notebookId);
  },

  setPagePinned: async (pageId, isPinned) => {
    const updated = await repo.setPagePinned(pageId, isPinned);
    if (!updated) return;
    set((s) => ({ pages: s.pages.map((p) => p.id === pageId ? updated : p) }));
    if (get().selectedNotebookId) await get().loadPagesByNotebook(get().selectedNotebookId!);
  },

  clearPageSelection: () => set({ selectedNotebookId: null, selectedPageId: null, pages: [] }),
  clearPageEditorSelection: () => set({ selectedPageId: null }),

  createTag: async (name) => {
    const tag = await repo.createTag(name);
    set((s) => ({ tags: [...s.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
    return tag;
  },

  renameTag: async (id, name) => {
    const tag = await repo.renameTag(id, name);
    set((s) => ({ tags: s.tags.map((t) => t.id === id ? tag : t).sort((a, b) => a.name.localeCompare(b.name)) }));
  },

  deleteTag: async (id) => {
    const affected = await repo.deleteTag(id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id), pages: s.pages.map((p) => affected.includes(p.id) ? { ...p, tagIds: (p.tagIds || []).filter((t) => t !== id) } : p) }));
    return affected;
  },

  setPageTags: async (pageId, tagIds) => {
    const page = await repo.setPageTags(pageId, tagIds);
    if (page) set((s) => ({ pages: s.pages.map((p) => p.id === pageId ? page : p) }));
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
