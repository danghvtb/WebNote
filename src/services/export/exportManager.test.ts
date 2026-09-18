import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import {
  createVaultBackupData,
  inspectBackup,
  restoreVaultData,
  type VaultBackupData,
} from './exportManager';

function fileFrom(value: unknown): File {
  return new File([JSON.stringify(value)], 'backup.json', { type: 'application/json' });
}

describe('vault backup export/import', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exports every local collection, including schedule, settings and revisions', async () => {
    await db.days.put({ id: 'day_20260917', date: '2026-09-17' });
    await db.notebooks.put({ id: 'nb_1', dateId: 'day_20260917', title: 'Notebook', icon: 'Book', createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', pageIds: [] });
    await db.pages.put({ id: 'page_1', notebookId: 'nb_1', title: 'Page', content: '<p>Content</p>', order: 0, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', tagIds: [] });
    await db.attachments.put({ id: 'attachment_1', pageId: 'page_1', name: 'demo.txt', mimeType: 'text/plain', size: 4, dataUrl: 'data:text/plain;base64,ZHJhdA==', createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z' });
    await db.revisions.put({ id: 'rev_1', pageId: 'page_1', title: 'Page', content: 'old', createdAt: '2026-09-16T00:00:00Z', deviceId: 'test' });
    await db.scheduleBlocks.put({ id: 'sched_1', title: 'Focus', date: '2026-09-17', completed: false, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z' });
    const backup = await createVaultBackupData();
    expect(backup.version).toBe('7.0');
    expect(backup.revisions).toHaveLength(1);
    expect(backup.scheduleBlocks).toHaveLength(1);
    expect(backup.customTasks).toEqual([]);
    expect(backup.workCategories).toEqual([]);
    expect(backup.attachments).toHaveLength(1);
    expect(backup.settings.theme).toBeTruthy();
  });

  it('accepts legacy backups and defaults omitted collections and page tags', async () => {
    const plan = await inspectBackup(fileFrom({
      version: '6.0',
      days: [{ id: 'day_20260917', date: '2026-09-17' }],
      notebooks: [{ id: 'nb_1', dateId: 'day_20260917', title: 'Notebook', icon: 'Book', createdAt: 'x', updatedAt: 'x', pageIds: [] }],
      pages: [{ id: 'page_1', notebookId: 'nb_1', title: 'Page', content: '', order: 0, createdAt: 'x', updatedAt: 'x' }],
    }));
    expect(plan.backup.pages[0].tagIds).toEqual([]);
    expect(plan.backup.tags).toEqual([]);
    expect(plan.backup.scheduleBlocks).toEqual([]);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('normalizes optional browser preferences and report templates', async () => {
    const plan = await inspectBackup(fileFrom({
      version: '7.0', pages: [],
      settings: {
        theme: 'light', editorFontSize: 18, editorLineHeight: 1.8, codeTheme: 'github',
        notificationsEnabled: true,
        notificationSoundEnabled: false,
        reportTemplates: [{ id: 'custom_1', name: 'Mẫu', issue: '', solution: '', nextWork: 'Theo dõi' }, { id: 'bad' }],
      },
    }));
    expect(plan.backup.settings.notificationsEnabled).toBe(true);
    expect(plan.backup.settings.notificationSoundEnabled).toBe(false);
    expect(plan.backup.settings.reportTemplates).toHaveLength(1);
  });

  it('rejects backups from a newer schema before touching the vault', async () => {
    await db.days.put({ id: 'day_existing', date: '2026-09-17' });
    await expect(inspectBackup(fileFrom({ version: '8.0', pages: [] }))).rejects.toThrow(/newer|mới hơn/i);
    expect(await db.days.get('day_existing')).toBeTruthy();
  });

  it('rejects malformed relationships before changing existing local data', async () => {
    await db.days.put({ id: 'day_existing', date: '2026-09-17' });
    await expect(inspectBackup(fileFrom({
      pages: [{ id: 'page_bad', notebookId: 'missing', title: 'Bad', content: '', order: 0, createdAt: 'x', updatedAt: 'x' }],
    }))).rejects.toThrow(/notebook/i);
    expect(await db.days.get('day_existing')).toBeTruthy();
  });

  it('restores a complete backup atomically and rebuilds the search index', async () => {
    const backup: VaultBackupData = {
      version: '7.0', exportDate: new Date().toISOString(),
      days: [{ id: 'day_20260917', date: '2026-09-17' }],
      notebooks: [{ id: 'nb_1', dateId: 'day_20260917', title: 'Notebook', icon: 'Book', createdAt: 'x', updatedAt: 'x', pageIds: [] }],
      pages: [{ id: 'page_1', notebookId: 'nb_1', title: 'Searchable', content: '<p>needle</p>', order: 0, createdAt: 'x', updatedAt: 'x', tagIds: [] }],
      tags: [], projects: [], workReports: [], scheduleBlocks: [], customTasks: [], workCategories: [], revisions: [], attachments: [],
      settings: { theme: 'dark', editorFontSize: 16, editorLineHeight: 1.6, codeTheme: 'github-dark' },
    };
    await restoreVaultData(backup);
    expect(await db.pages.get('page_1')).toBeTruthy();
    expect(await db.searchIndex.get('search_page_1')).toMatchObject({ title: 'Searchable', content: 'needle' });
    expect(await db.days.count()).toBe(1);
  });

  it('round-trips every domain collection without dropping relationships', async () => {
    const now = '2026-09-17T00:00:00Z';
    await db.days.put({ id: 'day_roundtrip', date: '2026-09-17' });
    await db.notebooks.put({ id: 'nb_roundtrip', dateId: 'day_roundtrip', title: 'Nhật ký', icon: 'Book', createdAt: now, updatedAt: now, pageIds: ['page_roundtrip'] });
    await db.tags.put({ id: 'tag_roundtrip', name: 'Quan trọng', normalizedName: 'quan trọng', createdAt: now, updatedAt: now });
    await db.pages.put({ id: 'page_roundtrip', notebookId: 'nb_roundtrip', title: 'Trang', content: '<p>Nội dung</p>', order: 0, createdAt: now, updatedAt: now, tagIds: ['tag_roundtrip'] });
    await db.projects.put({ id: 'project_roundtrip', name: 'Dự án', normalizedName: 'dự án', description: '', createdAt: now, updatedAt: now });
    await db.workReports.put({ id: 'report_roundtrip', dayId: 'day_roundtrip', projectEntries: [{ projectId: 'project_roundtrip', projectNameSnapshot: 'Dự án', content: 'Làm việc', result: 'Xong' }], issue: '', solution: '', nextWork: '', createdAt: now, updatedAt: now });
    await db.scheduleBlocks.put({ id: 'schedule_roundtrip', title: 'Họp', date: '2026-09-17', completed: false, createdAt: now, updatedAt: now });
    await db.customTasks.put({ id: 'task_roundtrip', title: 'Việc', description: '', status: 'todo', createdAt: now, updatedAt: now });
    await db.workCategories.put({ id: 'category_roundtrip', name: 'Chung', color: '#fff', createdAt: now });
    await db.revisions.put({ id: 'revision_roundtrip', pageId: 'page_roundtrip', title: 'Cũ', content: 'Cũ', createdAt: now, deviceId: 'test' });
    await db.attachments.put({ id: 'attachment_roundtrip', pageId: 'page_roundtrip', name: 'a.txt', mimeType: 'text/plain', size: 1, dataUrl: 'data:text/plain,a', createdAt: now, updatedAt: now });

    const backup = await createVaultBackupData();
    await restoreVaultData({ ...backup, days: [], notebooks: [], pages: [], tags: [], projects: [], workReports: [], scheduleBlocks: [], customTasks: [], workCategories: [], revisions: [], attachments: [] });
    await restoreVaultData(backup);
    expect(await db.days.count()).toBe(1);
    expect(await db.notebooks.count()).toBe(1);
    expect((await db.pages.get('page_roundtrip'))?.tagIds).toEqual(['tag_roundtrip']);
    expect((await db.workReports.get('report_roundtrip'))?.projectEntries[0].projectId).toBe('project_roundtrip');
    expect(await db.scheduleBlocks.count()).toBe(1);
    expect(await db.customTasks.count()).toBe(1);
    expect(await db.workCategories.count()).toBe(1);
    expect(await db.revisions.count()).toBe(1);
    expect(await db.attachments.count()).toBe(1);
  });
});
