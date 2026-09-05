// ============================================================
// MyNotes — Data Repository
// Business logic for CRUD operations on Days, Notebooks, Pages.
// Abstracts IndexedDB from UI components.
// ============================================================

import { db } from './db';
import type { Day, Notebook, Page, SearchEntry } from '../../types';
import {
  generateId,
  dayIdFromDate,
  todayId,
  todayDate,
  nowISO,
  stripHtml,
} from '../../utils';

// ===================== DAY OPERATIONS =====================

/**
 * Get or create today's Day record.
 */
export async function ensureToday(): Promise<Day> {
  const id = todayId();
  const existing = await db.days.get(id);
  if (existing) return existing;

  const day: Day = {
    id,
    date: todayDate(),
  };
  await db.days.put(day);
  return day;
}

/**
 * Get or create a Day for a specific date.
 */
export async function ensureDay(date: string): Promise<Day> {
  const id = dayIdFromDate(date);
  const existing = await db.days.get(id);
  if (existing) return existing;

  const day: Day = { id, date };
  await db.days.put(day);
  return day;
}

/**
 * Get all days, sorted by date descending (newest first).
 */
export async function getAllDays(): Promise<Day[]> {
  const days = await db.days.orderBy('date').reverse().toArray();
  return days;
}

/**
 * Get days grouped by month.
 */
export async function getDaysGroupedByMonth(): Promise<Map<string, Day[]>> {
  const days = await getAllDays();
  const grouped = new Map<string, Day[]>();

  for (const day of days) {
    const [year, month] = day.date.split('-');
    const key = `${year}-${month}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(day);
  }

  return grouped;
}

// ===================== NOTEBOOK OPERATIONS =====================

/**
 * Create a new Notebook.
 */
export async function createNotebook(
  title: string,
  dateId?: string,
  icon: string = 'notebook'
): Promise<Notebook> {
  const targetDayId = dateId || todayId();

  // Ensure the day exists
  if (!dateId) {
    await ensureToday();
  }

  const now = nowISO();
  const notebook: Notebook = {
    id: generateId('nb'),
    dateId: targetDayId,
    title,
    icon,
    createdAt: now,
    updatedAt: now,
    pageIds: [],
  };

  await db.notebooks.put(notebook);
  await updateSearchIndexForNotebook(notebook);
  return notebook;
}

/**
 * Get all notebooks for a day.
 */
export async function getNotebooksByDay(dayId: string): Promise<Notebook[]> {
  return db.notebooks
    .where('dateId')
    .equals(dayId)
    .filter((nb) => !nb.deleted)
    .sortBy('updatedAt')
    .then((nbs) => nbs.reverse());
}

/**
 * Get a notebook by ID.
 */
export async function getNotebook(notebookId: string): Promise<Notebook | undefined> {
  return db.notebooks.get(notebookId);
}

/**
 * Update a notebook.
 */
export async function updateNotebook(
  notebookId: string,
  updates: Partial<Pick<Notebook, 'title' | 'icon' | 'pageIds'>>
): Promise<Notebook | undefined> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return undefined;

  const updated = {
    ...notebook,
    ...updates,
    updatedAt: nowISO(),
  };

  await db.notebooks.put(updated);
  await updateSearchIndexForNotebook(updated);
  return updated;
}

/**
 * Soft-delete a notebook and its pages.
 */
export async function deleteNotebook(notebookId: string): Promise<void> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) return;

  // Soft-delete all pages
  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
  for (const page of pages) {
    await db.pages.update(page.id, { deleted: true, updatedAt: nowISO() });
  }

  // Soft-delete notebook
  await db.notebooks.update(notebookId, { deleted: true, updatedAt: nowISO() });

  // Remove from search index
  await db.searchIndex.where('entityId').equals(notebookId).delete();
  for (const page of pages) {
    await db.searchIndex.where('entityId').equals(page.id).delete();
  }
}

/**
 * Duplicate a notebook with all its pages.
 */
export async function duplicateNotebook(notebookId: string): Promise<Notebook | null> {
  const original = await db.notebooks.get(notebookId);
  if (!original) return null;

  const now = nowISO();
  const newNotebook: Notebook = {
    ...original,
    id: generateId('nb'),
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    pageIds: [],
  };

  // Duplicate pages
  const pages = await db.pages.where('notebookId').equals(notebookId).toArray();
  for (const page of pages) {
    const newPage: Page = {
      ...page,
      id: generateId('page'),
      notebookId: newNotebook.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.pages.put(newPage);
    newNotebook.pageIds.push(newPage.id);
    await updateSearchIndexForPage(newPage, newNotebook.title);
  }

  await db.notebooks.put(newNotebook);
  await updateSearchIndexForNotebook(newNotebook);
  return newNotebook;
}

/**
 * Get recently modified notebooks across all days.
 */
export async function getRecentNotebooks(limit: number = 10): Promise<Notebook[]> {
  return db.notebooks
    .orderBy('updatedAt')
    .reverse()
    .filter((nb) => !nb.deleted)
    .limit(limit)
    .toArray();
}

/**
 * Get total notebook count for a day.
 */
export async function getNotebookCountByDay(dayId: string): Promise<number> {
  return db.notebooks
    .where('dateId')
    .equals(dayId)
    .filter((nb) => !nb.deleted)
    .count();
}

// ===================== PAGE OPERATIONS =====================

/**
 * Create a new Page in a Notebook.
 */
export async function createPage(
  notebookId: string,
  title: string = 'Untitled'
): Promise<Page> {
  const notebook = await db.notebooks.get(notebookId);
  if (!notebook) throw new Error(`Notebook ${notebookId} not found`);

  const now = nowISO();
  const order = notebook.pageIds.length;
  const page: Page = {
    id: generateId('page'),
    notebookId,
    title,
    content: '',
    order,
    createdAt: now,
    updatedAt: now,
  };

  await db.pages.put(page);

  // Add page to notebook's pageIds
  const updatedPageIds = [...notebook.pageIds, page.id];
  await db.notebooks.update(notebookId, {
    pageIds: updatedPageIds,
    updatedAt: now,
  });

  await updateSearchIndexForPage(page, notebook.title);
  return page;
}

/**
 * Get all pages for a notebook.
 */
export async function getPagesByNotebook(notebookId: string): Promise<Page[]> {
  return db.pages
    .where('notebookId')
    .equals(notebookId)
    .filter((p) => !p.deleted)
    .sortBy('order');
}

/**
 * Get a page by ID.
 */
export async function getPage(pageId: string): Promise<Page | undefined> {
  return db.pages.get(pageId);
}

/**
 * Update a page's content (called by autosave).
 */
export async function updatePageContent(
  pageId: string,
  content: string
): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;

  const updated = {
    ...page,
    content,
    updatedAt: nowISO(),
  };

  await db.pages.put(updated);

  // Get notebook title for search index
  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    await updateSearchIndexForPage(updated, notebook.title);
  }

  return updated;
}

/**
 * Update a page's title.
 */
export async function updatePageTitle(
  pageId: string,
  title: string
): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;

  const updated = { ...page, title, updatedAt: nowISO() };
  await db.pages.put(updated);

  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    await updateSearchIndexForPage(updated, notebook.title);
  }

  return updated;
}

/**
 * Soft-delete a page.
 */
export async function deletePage(pageId: string): Promise<void> {
  const page = await db.pages.get(pageId);
  if (!page) return;

  // Soft-delete
  await db.pages.update(pageId, { deleted: true, updatedAt: nowISO() });

  // Remove from notebook's pageIds
  const notebook = await db.notebooks.get(page.notebookId);
  if (notebook) {
    const updatedPageIds = notebook.pageIds.filter((id) => id !== pageId);
    await db.notebooks.update(notebook.id, {
      pageIds: updatedPageIds,
      updatedAt: nowISO(),
    });
  }

  // Remove from search index
  await db.searchIndex.where('entityId').equals(pageId).delete();
}

/**
 * Reorder pages within a notebook (after drag & drop).
 */
export async function reorderPages(
  notebookId: string,
  pageIds: string[]
): Promise<void> {
  const now = nowISO();

  // Update each page's order
  for (let i = 0; i < pageIds.length; i++) {
    await db.pages.update(pageIds[i], { order: i, updatedAt: now });
  }

  // Update notebook's pageIds
  await db.notebooks.update(notebookId, { pageIds, updatedAt: now });
}

// ===================== SEARCH INDEX =====================

/**
 * Update search index entry for a notebook.
 */
async function updateSearchIndexForNotebook(notebook: Notebook): Promise<void> {
  const entry: SearchEntry = {
    id: `search_${notebook.id}`,
    type: 'notebook',
    entityId: notebook.id,
    title: notebook.title,
    content: notebook.title,
    date: notebook.dateId.replace('day_', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
  };
  await db.searchIndex.put(entry);
}

/**
 * Update search index entry for a page.
 */
async function updateSearchIndexForPage(page: Page, notebookTitle: string): Promise<void> {
  const plainContent = stripHtml(page.content);
  const entry: SearchEntry = {
    id: `search_${page.id}`,
    type: 'page',
    entityId: page.id,
    title: page.title,
    content: plainContent,
    date: '',
    notebookId: page.notebookId,
    notebookTitle,
  };
  await db.searchIndex.put(entry);
}

/**
 * Search across all indexed content.
 */
export async function searchAll(query: string): Promise<SearchEntry[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const entries = await db.searchIndex.toArray();

  return entries
    .filter((entry) => {
      return (
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.content.toLowerCase().includes(lowerQuery) ||
        (entry.notebookTitle && entry.notebookTitle.toLowerCase().includes(lowerQuery))
      );
    })
    .slice(0, 20); // Limit results
}

// ===================== BULK OPERATIONS =====================

/**
 * Load all data from a database.json payload into IndexedDB.
 * Used during initial sync from Google Drive.
 */
export async function loadFromDatabase(data: {
  days: Day[];
  notebooks: Notebook[];
  pages?: Page[];
}): Promise<void> {
  await db.transaction('rw', [db.days, db.notebooks, db.pages, db.searchIndex], async () => {
    // Clear existing data
    await db.days.clear();
    await db.notebooks.clear();

    // Load days
    if (data.days?.length) {
      await db.days.bulkPut(data.days);
    }

    // Load notebooks
    if (data.notebooks?.length) {
      await db.notebooks.bulkPut(data.notebooks);
    }

    // Load pages if included
    if (data.pages?.length) {
      await db.pages.clear();
      await db.pages.bulkPut(data.pages);
    }

    // Rebuild search index
    await db.searchIndex.clear();
    for (const nb of data.notebooks || []) {
      if (!nb.deleted) {
        await updateSearchIndexForNotebook(nb);
      }
    }
    for (const page of data.pages || []) {
      if (!page.deleted) {
        const nb = data.notebooks?.find((n) => n.id === page.notebookId);
        await updateSearchIndexForPage(page, nb?.title || '');
      }
    }
  });
}

/**
 * Export all data as a database object for saving to Google Drive.
 */
export async function exportDatabase(): Promise<{
  version: number;
  updatedAt: string;
  days: Day[];
  notebooks: Notebook[];
  pages: Page[];
}> {
  const days = await db.days.toArray();
  const notebooks = await db.notebooks.filter((nb) => !nb.deleted).toArray();
  const pages = await db.pages.filter((p) => !p.deleted).toArray();

  return {
    version: 1,
    updatedAt: nowISO(),
    days,
    notebooks,
    pages,
  };
}

/**
 * Get all active pages across all notebooks in the entire vault.
 */
export async function getAllVaultPages(): Promise<Page[]> {
  return db.pages.filter((p) => !p.deleted).toArray();
}

/**
 * Get all active notebooks across the entire vault.
 */
export async function getAllVaultNotebooks(): Promise<Notebook[]> {
  return db.notebooks.filter((nb) => !nb.deleted).toArray();
}
