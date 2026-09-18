import { describe, expect, it } from 'vitest';
import { extractWikiLinks, normalizeComparableText } from './index';

describe('text normalization and wiki links', () => {
  it('matches Vietnamese text regardless of case, accents and whitespace', () => {
    expect(normalizeComparableText('  Báo   Cáo  Công việc ')).toBe('bao cao cong viec');
    expect(normalizeComparableText('ĐỒ ÁN')).toBe('do an');
  });

  it('extracts wiki links from editor HTML', () => {
    expect(extractWikiLinks('<p>Liên kết [[Báo cáo]] và [[Kế hoạch]]</p>')).toEqual(['Báo cáo', 'Kế hoạch']);
  });
});
