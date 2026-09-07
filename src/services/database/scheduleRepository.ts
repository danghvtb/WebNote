// ============================================================
// MyNotes — Schedule Repository
// Data operations for Smart Schedule & Time Blocking
// ============================================================

import { db } from './db';
import type { ScheduleBlock, ScheduleSearchFilter } from '../../types';
import { generateId, nowISO, todayDate } from '../../utils';
import { queueSync } from '../sync/syncManager';

/**
 * Filter schedule blocks based on multi-criteria filter object
 */
export function filterScheduleBlocks(blocks: ScheduleBlock[], filter: ScheduleSearchFilter): ScheduleBlock[] {
  let result = [...blocks];
  const todayStr = todayDate();

  // 1. Keyword search (Title or description)
  if (filter.keyword && filter.keyword.trim()) {
    const kw = filter.keyword.trim().toLowerCase();
    result = result.filter(
      (b) => b.title.toLowerCase().includes(kw) || (b.description && b.description.toLowerCase().includes(kw))
    );
  }

  // 2. Category filter
  if (filter.categoryId && filter.categoryId !== 'all') {
    result = result.filter((b) => b.categoryId === filter.categoryId);
  }

  // 3. Task Source filter (Work Tasks vs Note Tasks vs All)
  if (filter.taskSource && filter.taskSource !== 'all') {
    if (filter.taskSource === 'work') {
      result = result.filter((b) => !!b.customTaskId);
    } else if (filter.taskSource === 'note') {
      result = result.filter((b) => !!b.taskId);
    }
  }

  // 4. Status filter (Pending, Completed, Overdue)
  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'pending') {
      result = result.filter((b) => !b.completed);
    } else if (filter.status === 'completed') {
      result = result.filter((b) => b.completed);
    } else if (filter.status === 'overdue') {
      result = result.filter((b) => !b.completed && b.date < todayStr);
    }
  }

  // 5. Priority filter
  if (filter.priority && filter.priority !== 'all') {
    result = result.filter((b) => b.priority === filter.priority);
  }

  // 6. Date Range & Preset filter
  if (filter.datePreset && filter.datePreset !== 'all') {
    const today = new Date();
    if (filter.datePreset === 'today') {
      result = result.filter((b) => b.date === todayStr);
    } else if (filter.datePreset === 'this_week') {
      const dayOfWeek = today.getDay();
      const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(today);
      mon.setDate(today.getDate() + distToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const monStr = mon.toISOString().split('T')[0];
      const sunStr = sun.toISOString().split('T')[0];
      result = result.filter((b) => b.date >= monStr && b.date <= sunStr);
    } else if (filter.datePreset === 'this_month') {
      const yearMonth = todayStr.substring(0, 7); // YYYY-MM
      result = result.filter((b) => b.date.startsWith(yearMonth));
    } else if (filter.datePreset === 'next_7_days') {
      const next7 = new Date(today);
      next7.setDate(today.getDate() + 7);
      const next7Str = next7.toISOString().split('T')[0];
      result = result.filter((b) => b.date >= todayStr && b.date <= next7Str);
    }
  }

  // Custom Date Range
  if (filter.startDate) {
    result = result.filter((b) => b.date >= filter.startDate!);
  }
  if (filter.endDate) {
    result = result.filter((b) => b.date <= filter.endDate!);
  }

  return result;
}


/**
 * Save or update a schedule block in IndexedDB
 */
export async function saveScheduleBlock(
  block: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ScheduleBlock> {
  const now = nowISO();
  const id = block.id || generateId('sched');
  const isUpdate = !!block.id;
  
  const scheduleBlock: ScheduleBlock = {
    ...block,
    id,
    completed: block.completed ?? false,
    createdAt: (block as any).createdAt || now,
    updatedAt: now,
  };

  await db.scheduleBlocks.put(scheduleBlock);
  await queueSync(isUpdate ? 'update' : 'create', 'schedule', id, scheduleBlock);
  return scheduleBlock;
}

/**
 * Get all schedule blocks for a specific date (YYYY-MM-DD)
 */
export async function getScheduleBlocksByDate(date: string): Promise<ScheduleBlock[]> {
  try {
    return await db.scheduleBlocks.where('date').equals(date).toArray();
  } catch (err) {
    console.warn('[ScheduleRepo] Error fetching blocks by date:', err);
    return [];
  }
}

/**
 * Get all schedule blocks within a date range (inclusive)
 */
export async function getScheduleBlocksByRange(startDate: string, endDate: string): Promise<ScheduleBlock[]> {
  try {
    return await db.scheduleBlocks
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  } catch (err) {
    console.warn('[ScheduleRepo] Error fetching blocks by range:', err);
    return [];
  }
}

/**
 * Get all schedule blocks in the entire vault
 */
export async function getAllScheduleBlocks(): Promise<ScheduleBlock[]> {
  try {
    return await db.scheduleBlocks.toArray();
  } catch (err) {
    console.warn('[ScheduleRepo] Error fetching all schedule blocks:', err);
    return [];
  }
}

/**
 * Delete a schedule block by ID
 */
export async function deleteScheduleBlock(id: string): Promise<void> {
  await db.scheduleBlocks.delete(id);
  await queueSync('delete', 'schedule', id);
}

/**
 * Toggle completed status of a schedule block
 */
export async function toggleScheduleBlockCompleted(id: string): Promise<ScheduleBlock | null> {
  const block = await db.scheduleBlocks.get(id);
  if (!block) return null;

  const updated: ScheduleBlock = {
    ...block,
    completed: !block.completed,
    updatedAt: nowISO(),
  };

  await db.scheduleBlocks.put(updated);
  await queueSync('update', 'schedule', id, updated);
  return updated;
}
