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
} from '../../types';

export class MyNotesDB extends Dexie {
  days!: Table<Day, string>;
  notebooks!: Table<Notebook, string>;
  pages!: Table<Page, string>;
  revisions!: Table<Revision, string>;
  syncQueue!: Table<SyncOperation, string>;
  appState!: Table<AppStateRecord, string>;
  searchIndex!: Table<SearchEntry, string>;

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
    [db.days, db.notebooks, db.pages, db.revisions, db.syncQueue, db.searchIndex],
    async () => {
      await db.days.clear();
      await db.notebooks.clear();
      await db.pages.clear();
      await db.revisions.clear();
      await db.syncQueue.clear();
      await db.searchIndex.clear();
    }
  );
}

/**
 * Clear only the sync queue.
 */
export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
