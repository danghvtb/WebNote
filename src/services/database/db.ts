// ============================================================
// MyNotes — IndexedDB Database (Dexie.js)
// Local-first cache for offline support and fast access.
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  Day,
  Notebook,
  Page,
  Revision,
  SyncOperation,
  AppStateRecord,
  SearchEntry,
  ScheduleBlock,
  CustomUserTask,
  WorkCategory,
  Tag,
} from '../../types';

export class MyNotesDB extends Dexie {
  days!: Table<Day, string>;
  notebooks!: Table<Notebook, string>;
  pages!: Table<Page, string>;
  revisions!: Table<Revision, string>;
  syncQueue!: Table<SyncOperation, string>;
  appState!: Table<AppStateRecord, string>;
  searchIndex!: Table<SearchEntry, string>;
  scheduleBlocks!: Table<ScheduleBlock, string>;
  customTasks!: Table<CustomUserTask, string>;
  workCategories!: Table<WorkCategory, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super('MyNotesDB');

    this.version(1).stores({
      days: 'id, date',
      notebooks: 'id, dateId, title, updatedAt',
      pages: 'id, notebookId, title, order, updatedAt',
      revisions: 'id, pageId, createdAt',
      syncQueue: 'id, status, timestamp',
      appState: 'key',
      searchIndex: 'id, entityId, type, title',
    });

    this.version(2).stores({
      scheduleBlocks: 'id, date, taskId, pageId, completed, updatedAt',
    });

    this.version(3).stores({
      scheduleBlocks: 'id, date, taskId, customTaskId, categoryId, pageId, completed, updatedAt',
      customTasks: 'id, categoryId, status, dueDate, updatedAt',
      workCategories: 'id, name',
    });

    this.version(4).stores({
      pages: 'id, notebookId, title, order, updatedAt, *tagIds',
      tags: 'id, &normalizedName, name, updatedAt',
    }).upgrade(async (tx) => {
      await tx.table('pages').toCollection().modify((page: Page) => {
        if (!Array.isArray(page.tagIds)) page.tagIds = [];
      });
    });
  }
}

export const db = new MyNotesDB();

/**
 * Clear all data from the database.
 * Used when user disconnects or clears cache.
 */
export async function clearDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [db.days, db.notebooks, db.pages, db.revisions, db.syncQueue, db.searchIndex, db.scheduleBlocks, db.customTasks, db.workCategories, db.tags],
    async () => {
      await db.days.clear();
      await db.notebooks.clear();
      await db.pages.clear();
      await db.revisions.clear();
      await db.syncQueue.clear();
      await db.searchIndex.clear();
      await db.scheduleBlocks.clear();
      await db.customTasks.clear();
      await db.workCategories.clear();
      await db.tags.clear();
    }
  );
}

/**
 * Clear only the sync queue.
 */
export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
