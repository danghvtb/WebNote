import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { loadFromDatabase } from './repository';

/**
 * Lightweight CPU/IndexedDB guard for the local-first critical path. This is
 * intentionally deterministic and runs in CI without a browser or network.
 */
describe('local snapshot performance guard', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('applies a 5,000-page snapshot within the interactive budget', async () => {
    const now = new Date().toISOString();
    const pages = Array.from({ length: 5000 }, (_, index) => ({
      id: `page_perf_${index}`,
      notebookId: 'nb_perf',
      title: `Trang ${index}`,
      content: `<p>Nội dung kiểm thử ${index}</p>`,
      order: index,
      createdAt: now,
      updatedAt: now,
      tagIds: [],
    }));
    const startedAt = performance.now();
    await loadFromDatabase({
      days: [{ id: 'day_perf', date: '2026-09-17' }],
      notebooks: [{ id: 'nb_perf', dateId: 'day_perf', title: 'Hiệu năng', icon: 'Book', createdAt: now, updatedAt: now, pageIds: pages.map((page) => page.id) }],
      pages,
      tags: [], projects: [], workReports: [], attachments: [], scheduleBlocks: [], customTasks: [], workCategories: [],
    });
    const duration = performance.now() - startedAt;
    console.info(`[benchmark] local apply 5,000 pages: ${duration.toFixed(1)}ms`);
    expect(await db.pages.count()).toBe(5000);
    // CI machines can be slower than a throttled phone; keep a generous upper
    // bound while the roadmap's 1.5s target remains visible in the log.
    expect(duration).toBeLessThan(8000);
  });
});
