import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  archiveProject,
  createOrGetWorkReport,
  createProject,
  deleteWorkReport,
  formatWorkReport,
  getWorkReportByDay,
  createNotebook,
  createPage,
  getPagesByNotebook,
  getNotebooksByDay,
  setNotebookPinned,
  setPagePinned,
  createRevision,
  getPageRevisions,
  restoreRevision,
  rebuildSearchIndex,
  restoreProject,
  searchAll,
  updateWorkReport,
  addPageAttachment,
  getPageAttachments,
  deletePageAttachment,
} from './repository';

describe('work report and project repository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('normalizes project names and rejects active duplicates', async () => {
    const project = await createProject('  Web   Note  ');
    expect(project.name).toBe('Web Note');
    await expect(createProject('web note')).rejects.toThrow();
    const archived = await archiveProject(project.id);
    expect(archived?.deletedAt).toBeTruthy();
    await restoreProject(project.id);
    expect((await createProject('Another')).name).toBe('Another');
  });

  it('keeps one report per day, supports multiple projects and formats text', async () => {
    await db.days.put({ id: 'day_20260917', date: '2026-09-17' });
    const first = await createOrGetWorkReport('day_20260917');
    const second = await createOrGetWorkReport('day_20260917');
    expect(second.id).toBe(first.id);

    const alpha = await createProject('Alpha');
    const beta = await createProject('Beta');
    const updated = await updateWorkReport(first.id, {
      projectEntries: [
        { projectId: alpha.id, projectNameSnapshot: alpha.name, content: 'Build\nTest', result: 'Done' },
        { projectId: beta.id, projectNameSnapshot: beta.name, content: 'Review', result: 'Merged' },
      ],
      issue: 'Blocked',
      solution: 'Ask team',
      nextWork: 'Deploy',
    });
    expect(updated?.projectEntries).toHaveLength(2);
    expect(formatWorkReport(updated!, '2026-09-17')).toContain('1. Alpha');
    expect(formatWorkReport(updated!, '2026-09-17')).toContain('+ Build');
    expect(formatWorkReport(updated!, '2026-09-17')).toContain('- Hướng giải quyết:');
  });

  it('searches reports and removes deleted reports from results', async () => {
    await db.days.put({ id: 'day_20260917', date: '2026-09-17' });
    const project = await createProject('Searchable Project');
    const report = await createOrGetWorkReport('day_20260917');
    await updateWorkReport(report.id, { projectEntries: [{ projectId: project.id, projectNameSnapshot: project.name, content: 'Unique report text', result: '' }] });
    expect((await searchAll('Unique report')).some((entry) => entry.type === 'work_report')).toBe(true);
    await deleteWorkReport(report.id);
    expect((await searchAll('Unique report')).some((entry) => entry.entityId === report.id)).toBe(false);
    expect(await getWorkReportByDay('day_20260917')).toBeUndefined();
  });

  it('prioritizes pinned notebooks and pages and restores revisions safely', async () => {
    await db.days.put({ id: 'day_20260917', date: '2026-09-17' });
    const first = await createNotebook('First', 'day_20260917');
    const second = await createNotebook('Second', 'day_20260917');
    await setNotebookPinned(second.id, true);
    expect((await getNotebooksByDay('day_20260917'))[0].id).toBe(second.id);

    const page = await createPage(first.id, 'Draft');
    await setPagePinned(page.id, true);
    expect((await getPagesByNotebook(first.id))[0].id).toBe(page.id);
    const revision = await createRevision(page.id);
    expect(revision?.pageId).toBe(page.id);
    await db.pages.update(page.id, { content: '<p>Changed</p>' });
    await restoreRevision(revision!.id);
    expect((await db.pages.get(page.id))?.content).toBe('');
    expect(await getPageRevisions(page.id)).toHaveLength(2);
  });

  it('supports unified type and date filters for projects, tasks and schedules', async () => {
    const now = new Date().toISOString();
    await db.projects.put({ id: 'project_demo', name: 'Dự án lọc', normalizedName: 'du an loc', createdAt: now, updatedAt: now });
    await db.customTasks.put({ id: 'task_demo', title: 'Kiểm tra triển khai', status: 'todo', dueDate: '2026-09-18', createdAt: now, updatedAt: now });
    await db.scheduleBlocks.put({ id: 'schedule_demo', title: 'Họp triển khai', date: '2026-09-19', completed: false, createdAt: now, updatedAt: now });
    await rebuildSearchIndex();
    expect((await searchAll({ query: 'triển khai', types: ['task'] })).map((entry) => entry.entityId)).toContain('task_demo');
    expect((await searchAll({ types: ['schedule'], startDate: '2026-09-19' })).map((entry) => entry.entityId)).toContain('schedule_demo');
    expect((await searchAll({ types: ['project'], projectIds: ['project_demo'] })).map((entry) => entry.entityId)).toContain('project_demo');
  });

  it('keeps page attachments local and supports soft delete', async () => {
    await db.days.put({ id: 'day_20260917', date: '2026-09-17' });
    const notebook = await createNotebook('Attachments', 'day_20260917');
    const page = await createPage(notebook.id, 'Files');
    const attachment = await addPageAttachment({ pageId: page.id, name: 'demo.txt', mimeType: 'text/plain', size: 4, dataUrl: 'data:text/plain;base64,ZHJhdA==' });
    expect(await getPageAttachments(page.id)).toHaveLength(1);
    await deletePageAttachment(attachment.id);
    expect(await getPageAttachments(page.id)).toHaveLength(0);
    expect(await getPageAttachments(page.id, true)).toHaveLength(1);
  });

  it('cascades page trash and restore to attachment metadata', async () => {
    await db.days.put({ id: 'day_20260918', date: '2026-09-18' });
    const notebook = await createNotebook('Cascade', 'day_20260918');
    const page = await createPage(notebook.id, 'Parent');
    const attachment = await addPageAttachment({ pageId: page.id, name: 'cascade.txt', mimeType: 'text/plain', size: 1, dataUrl: 'data:text/plain;base64,eA==' });
    const { deletePage, restorePage } = await import('./repository');
    await deletePage(page.id);
    expect((await db.attachments.get(attachment.id))?.deletedAt).toBeTruthy();
    await restorePage(page.id);
    expect((await db.attachments.get(attachment.id))?.deletedAt).toBeUndefined();
  });
});
