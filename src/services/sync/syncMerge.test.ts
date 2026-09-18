import { describe, expect, it } from 'vitest';
import { mergeNewerLocalRecords } from './syncManager';

const base = {
  version: 3,
  updatedAt: '2026-09-18T00:00:00.000Z',
  days: [{ id: 'day_1', date: '2026-09-18' }],
  notebooks: [{ id: 'nb_1', dateId: 'day_1', title: 'Ghi chú', icon: 'Book', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', pageIds: ['page_1'] }],
  pages: [], tags: [], projects: [], workReports: [], attachments: [], scheduleBlocks: [], customTasks: [], workCategories: [],
};

describe('cloud snapshot safety merge', () => {
  it('keeps a newer local page and a page missing from a stale snapshot', () => {
    const remote = { ...base, pages: [{ id: 'page_1', notebookId: 'nb_1', title: 'Cũ', content: '', order: 0, createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-17T00:00:00.000Z', tagIds: [] }] };
    const local = { ...base, pages: [
      { id: 'page_1', notebookId: 'nb_1', title: 'Mới', content: '<p>Không mất</p>', order: 0, createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-18T01:00:00.000Z', tagIds: [] },
      { id: 'page_2', notebookId: 'nb_1', title: 'Trang mới', content: 'Local', order: 1, createdAt: '2026-09-18T01:00:00.000Z', updatedAt: '2026-09-18T01:00:00.000Z', tagIds: [] },
    ] };
    const result = mergeNewerLocalRecords(remote, local);
    expect(result.snapshot.pages.map((page) => page.id)).toEqual(['page_1', 'page_2']);
    expect(result.snapshot.pages.find((page) => page.id === 'page_1')?.title).toBe('Mới');
    expect(result.preserved.map(({ item }) => item.id)).toEqual(['page_1', 'page_2']);
  });
});
