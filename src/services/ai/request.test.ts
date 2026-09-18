import { describe, expect, it } from 'vitest';
import type { Page } from '../../types';
import { buildAiRequest } from './request';

const pages: Page[] = [
  { id: 'p1', notebookId: 'n1', title: 'Một', content: '<p>A</p>', order: 0, createdAt: 'x', updatedAt: 'x', tagIds: [] },
  { id: 'p2', notebookId: 'n2', title: 'Hai', content: '<p>B</p>', order: 0, createdAt: 'x', updatedAt: 'x', tagIds: [] },
];

describe('AI request scope', () => {
  it('builds a preview limited to the requested page set', () => {
    const preview = buildAiRequest({ type: 'selected_pages', ids: ['p2'] }, pages);
    expect(preview.pageCount).toBe(1);
    expect(preview.context).toContain('Hai');
    expect(preview.context).not.toContain('Một');
  });

  it('supports notebook and vault scopes', () => {
    expect(buildAiRequest({ type: 'notebook', ids: ['n1'] }, pages).pageCount).toBe(1);
    expect(buildAiRequest({ type: 'vault' }, pages).pageCount).toBe(2);
  });
});
