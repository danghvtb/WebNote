// ============================================================
// MyNotes — Schedule Repository
// Data operations for Smart Schedule & Time Blocking
// ============================================================

import { db } from './db';
import type { ScheduleBlock } from '../../types';
import { generateId, nowISO } from '../../utils';

/**
 * Save or update a schedule block in IndexedDB
 */
export async function saveScheduleBlock(
  block: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ScheduleBlock> {
  const now = nowISO();
  const id = block.id || generateId('sched');
  
  const scheduleBlock: ScheduleBlock = {
    ...block,
    id,
    completed: block.completed ?? false,
    createdAt: (block as any).createdAt || now,
    updatedAt: now,
  };

  await db.scheduleBlocks.put(scheduleBlock);
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
  return updated;
}
