import {
  endOfWeek,
  format,
  getISOWeek,
  parseISO,
  startOfWeek,
} from 'date-fns';
import type { TimelineGroupingMode } from '../types';

export interface TimelineDayLike {
  id: string;
  date: string;
  notebookCount: number;
}

export interface TimelineGroup {
  key: string;
  label: string;
  days: TimelineDayLike[];
  notebookDayCount: number;
  notebookCount: number;
}

export interface TimelineNotebookLike {
  dateId: string;
  deleted?: boolean;
}

/** Parse a YYYY-MM-DD value as a local calendar date. */
export function parseTimelineDate(date: string): Date {
  return parseISO(date);
}

/** Convert a Day id (day_YYYYMMDD) back to its ISO calendar date. */
export function dateFromDayId(dayId: string | null): string | null {
  if (!dayId) return null;
  const compactDate = dayId.replace(/^day_/, '');
  if (!/^\d{8}$/.test(compactDate)) return null;
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

export function buildTimelineDays(
  days: Array<{ id: string; date: string }>,
  notebooks: TimelineNotebookLike[],
  today: { id: string; date: string },
): TimelineDayLike[] {
  const dayById = new Map(days.map((day) => [day.id, day]));

  if (!dayById.has(today.id)) {
    dayById.set(today.id, today);
  }

  const countByDay = new Map<string, number>();
  for (const notebook of notebooks) {
    if (notebook.deleted) continue;

    if (!dayById.has(notebook.dateId)) {
      const inferredDate = dateFromDayId(notebook.dateId);
      if (inferredDate) {
        dayById.set(notebook.dateId, { id: notebook.dateId, date: inferredDate });
      }
    }

    countByDay.set(notebook.dateId, (countByDay.get(notebook.dateId) || 0) + 1);
  }

  return Array.from(dayById.values())
    .map((day) => ({ ...day, notebookCount: countByDay.get(day.id) || 0 }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getTimelineGroupKey(
  date: string,
  mode: TimelineGroupingMode,
): string {
  const parsed = parseTimelineDate(date);

  if (mode === 'week') {
    return format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  }

  return format(parsed, 'yyyy-MM');
}

export function getTimelineGroupLabel(
  key: string,
  mode: TimelineGroupingMode,
): string {
  if (mode === 'week') {
    const start = parseTimelineDate(key);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    const weekNumber = getISOWeek(start);
    const startLabel = format(start, 'dd/MM/yyyy');
    const endLabel = format(end, 'dd/MM/yyyy');
    return `Tuần ${weekNumber} · ${startLabel}–${endLabel}`;
  }

  const monthDate = parseTimelineDate(`${key}-01`);
  return `Tháng ${format(monthDate, 'MM/yyyy')}`;
}

export function groupTimelineDays(
  days: TimelineDayLike[],
  mode: TimelineGroupingMode,
): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const day of days) {
    const key = getTimelineGroupKey(day.date, mode);
    const existing = groups.get(key);

    if (existing) {
      existing.days.push(day);
      if (day.notebookCount > 0) existing.notebookDayCount += 1;
      existing.notebookCount += day.notebookCount;
      continue;
    }

    groups.set(key, {
      key,
      label: getTimelineGroupLabel(key, mode),
      days: [day],
      notebookDayCount: day.notebookCount > 0 ? 1 : 0,
      notebookCount: day.notebookCount,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      days: [...group.days].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}
