import { describe, expect, it } from 'vitest';
import {
  buildTimelineDays,
  dateFromDayId,
  getTimelineGroupKey,
  groupTimelineDays,
} from './timelineGrouping';

describe('timeline grouping', () => {
  it('uses Monday as the start of a week and keeps groups newest first', () => {
    const days = [
      { id: 'day_20260920', date: '2026-09-20', notebookCount: 1 },
      { id: 'day_20260914', date: '2026-09-14', notebookCount: 2 },
      { id: 'day_20260913', date: '2026-09-13', notebookCount: 3 },
    ];

    const groups = groupTimelineDays(days, 'week');

    expect(getTimelineGroupKey('2026-09-20', 'week')).toBe('2026-09-14');
    expect(groups.map((group) => group.key)).toEqual(['2026-09-14', '2026-09-07']);
    expect(groups[0].days.map((day) => day.date)).toEqual(['2026-09-20', '2026-09-14']);
    expect(groups[0].notebookDayCount).toBe(2);
    expect(groups[0].notebookCount).toBe(3);
  });

  it('handles weeks crossing month and year boundaries', () => {
    const groups = groupTimelineDays(
      [
        { id: 'day_20260101', date: '2026-01-01', notebookCount: 1 },
        { id: 'day_20251229', date: '2025-12-29', notebookCount: 1 },
      ],
      'week',
    );

    expect(groups[0].key).toBe('2025-12-29');
    expect(groups[0].label).toContain('29/12/2025');
    expect(groups[0].label).toContain('04/01/2026');
  });

  it('groups by month and preserves leap-day dates', () => {
    const groups = groupTimelineDays(
      [
        { id: 'day_20240301', date: '2024-03-01', notebookCount: 1 },
        { id: 'day_20240229', date: '2024-02-29', notebookCount: 2 },
      ],
      'month',
    );

    expect(groups.map((group) => group.key)).toEqual(['2024-03', '2024-02']);
    expect(groups[1].days[0].date).toBe('2024-02-29');
  });

  it('retains an empty today and infers missing days from notebooks', () => {
    const days = buildTimelineDays(
      [{ id: 'day_20260916', date: '2026-09-16' }],
      [{ dateId: 'day_20260915' }],
      { id: 'day_20260917', date: '2026-09-17' },
    );

    expect(days).toEqual([
      { id: 'day_20260917', date: '2026-09-17', notebookCount: 0 },
      { id: 'day_20260916', date: '2026-09-16', notebookCount: 0 },
      { id: 'day_20260915', date: '2026-09-15', notebookCount: 1 },
    ]);

    expect(groupTimelineDays(days, 'week')[0].notebookDayCount).toBe(1);
  });

  it('does not count deleted notebooks', () => {
    const days = buildTimelineDays(
      [],
      [
        { dateId: 'day_20260917' },
        { dateId: 'day_20260917', deleted: true },
      ],
      { id: 'day_20260917', date: '2026-09-17' },
    );

    expect(days[0].notebookCount).toBe(1);
  });

  it('converts valid Day ids without timezone-dependent parsing', () => {
    expect(dateFromDayId('day_20260917')).toBe('2026-09-17');
    expect(dateFromDayId('invalid')).toBeNull();
  });
});
