// ============================================================
// MyNotes — Task & Category Repository
// Data operations & Cloud Queue Sync for Custom Tasks & Work Categories
// ============================================================

import { db } from './db';
import type { CustomUserTask, WorkCategory } from '../../types';
import { generateId, nowISO } from '../../utils';
import { queueSync } from '../sync/syncManager';

// Default categories if database is empty
export const DEFAULT_CATEGORIES: WorkCategory[] = [
  { id: 'cat_work', name: 'Công Việc', color: '#3b82f6', icon: 'Briefcase', createdAt: nowISO() },
  { id: 'cat_study', name: 'Học Tập', color: '#a855f7', icon: 'BookOpen', createdAt: nowISO() },
  { id: 'cat_personal', name: 'Cá Nhân', color: '#10b981', icon: 'User', createdAt: nowISO() },
  { id: 'cat_project', name: 'Dự Án WebNote', color: '#f59e0b', icon: 'FolderKanban', createdAt: nowISO() },
];

/**
 * Ensure default work categories exist in database
 */
export async function ensureDefaultCategories(): Promise<WorkCategory[]> {
  const count = await db.workCategories.count();
  if (count === 0) {
    await db.workCategories.bulkPut(DEFAULT_CATEGORIES);
    for (const cat of DEFAULT_CATEGORIES) {
      await queueSync('create', 'schedule', cat.id, cat);
    }
    return DEFAULT_CATEGORIES;
  }
  return db.workCategories.toArray();
}

/**
 * Get all work categories
 */
export async function getAllCategories(): Promise<WorkCategory[]> {
  const cats = await db.workCategories.toArray();
  if (cats.length === 0) {
    return ensureDefaultCategories();
  }
  return cats;
}

/**
 * Save or update a work category
 */
export async function saveWorkCategory(catData: Omit<WorkCategory, 'id' | 'createdAt'> & { id?: string }): Promise<WorkCategory> {
  const now = nowISO();
  const id = catData.id || generateId('cat');
  const isUpdate = !!catData.id;

  const category: WorkCategory = {
    ...catData,
    id,
    createdAt: (catData as any).createdAt || now,
  };

  await db.workCategories.put(category);
  await queueSync(isUpdate ? 'update' : 'create', 'schedule', id, category);
  return category;
}

/**
 * Delete a work category
 */
export async function deleteWorkCategory(id: string): Promise<void> {
  await db.workCategories.delete(id);
  await queueSync('delete', 'schedule', id);
}

/**
 * Get all custom tasks
 */
export async function getAllCustomTasks(): Promise<CustomUserTask[]> {
  return db.customTasks.reverse().sortBy('createdAt');
}

/**
 * Save or update a custom task
 */
export async function saveCustomTask(
  taskData: Omit<CustomUserTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<CustomUserTask> {
  const now = nowISO();
  const id = taskData.id || generateId('utask');
  const isUpdate = !!taskData.id;

  const task: CustomUserTask = {
    ...taskData,
    id,
    status: taskData.status || 'todo',
    createdAt: (taskData as any).createdAt || now,
    updatedAt: now,
  };

  await db.customTasks.put(task);
  await queueSync(isUpdate ? 'update' : 'create', 'schedule', id, task);
  return task;
}

/**
 * Delete a custom task
 */
export async function deleteCustomTask(id: string): Promise<void> {
  await db.customTasks.delete(id);
  await queueSync('delete', 'schedule', id);
}

/**
 * Toggle custom task completion status
 */
export async function toggleCustomTaskStatus(id: string): Promise<CustomUserTask | null> {
  const task = await db.customTasks.get(id);
  if (!task) return null;

  const newStatus = task.status === 'completed' ? 'todo' : 'completed';
  const updated: CustomUserTask = {
    ...task,
    status: newStatus,
    updatedAt: nowISO(),
  };

  await db.customTasks.put(updated);
  await queueSync('update', 'schedule', id, updated);
  return updated;
}
