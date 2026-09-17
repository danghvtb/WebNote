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
  restoreProject,
  searchAll,
  updateWorkReport,
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
});
