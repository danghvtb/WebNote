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
  Project,
  WorkReport,
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
  projects!: Table<Project, string>;
  workReports!: Table<WorkReport, string>;

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
      const tagsTable = tx.table('tags');
      const searchTable = tx.table('searchIndex');
      await tx.table('pages').toCollection().modify((page: Page) => {
        if (!Array.isArray(page.tagIds)) page.tagIds = [];
      });
      const pages = await tx.table('pages').toArray();
      for (const page of pages) {
        const entry = await searchTable.get(`search_${page.id}`);
        if (!entry) continue;
        const tagNames: string[] = [];
        for (const tagId of page.tagIds || []) {
          const tag = await tagsTable.get(tagId);
          if (tag?.name) tagNames.push(tag.name);
        }
        await searchTable.put({ ...entry, tagIds: page.tagIds || [], tagNames });
      }
    });

    this.version(5).stores({
      projects: 'id, &normalizedName, name, updatedAt, deletedAt',
      workReports: 'id, &dayId, updatedAt, deletedAt',
    }).upgrade(async (tx) => {
      await tx.table('workReports').toCollection().modify((report: Partial<WorkReport>) => {
        if (!Array.isArray(report.projectEntries)) report.projectEntries = [];
        if (typeof report.issue !== 'string') report.issue = '';
        if (typeof report.solution !== 'string') report.solution = '';
        if (typeof report.nextWork !== 'string') report.nextWork = '';
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
    [db.days, db.notebooks, db.pages, db.revisions, db.syncQueue, db.appState, db.searchIndex, db.scheduleBlocks, db.customTasks, db.workCategories, db.tags, db.projects, db.workReports],
    async () => {
      await db.days.clear();
      await db.notebooks.clear();
      await db.pages.clear();
      await db.revisions.clear();
      await db.syncQueue.clear();
      await db.appState.clear();
      await db.searchIndex.clear();
      await db.scheduleBlocks.clear();
      await db.customTasks.clear();
      await db.workCategories.clear();
      await db.tags.clear();
      await db.projects.clear();
      await db.workReports.clear();
    }
  );
}

/**
 * Clear only the sync queue.
 */
export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
