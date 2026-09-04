// ============================================================
// MyNotes — Sync Manager
// Orchestrates local IndexedDB ↔ Google Drive synchronization.
// ============================================================

import { db } from '../database/db';
import { exportDatabase, loadFromDatabase } from '../database/repository';
import {
  findFileInFolder,
  createFile,
  updateFile,
  downloadFile,
  createFolder,
  listFiles,
} from '../google/drive';
import { getRootFolderId } from '../google/rootFolderManager';
import type { SyncOperation, SyncStatus, Page } from '../../types';
import { generateId, nowISO, isOnline } from '../../utils';

// Sync state — subscribers can listen for changes
type SyncListener = (status: SyncStatus, message?: string) => void;
const listeners: Set<SyncListener> = new Set();

let currentStatus: SyncStatus = 'idle';
let lastSyncTime: string | null = null;
let syncInProgress = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000; // 2 seconds, exponential backoff

/**
 * Subscribe to sync status changes.
 */
export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get current sync status.
 */
export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

/**
 * Get last sync time.
 */
export function getLastSyncTime(): string | null {
  return lastSyncTime;
}

function setStatus(status: SyncStatus, message?: string): void {
  currentStatus = status;
  listeners.forEach((l) => l(status, message));
}

// ===================== SYNC TO CLOUD =====================

/**
 * Queue a sync operation.
 * Called after any local data change (autosave, create, delete).
 */
export async function queueSync(
  type: SyncOperation['type'],
  entity: SyncOperation['entity'],
  entityId: string,
  data?: unknown
): Promise<void> {
  const op: SyncOperation = {
    id: generateId('sync'),
    type,
    entity,
    entityId,
    data: data ? JSON.stringify(data) : '',
    timestamp: nowISO(),
    retries: 0,
    maxRetries: MAX_RETRIES,
    status: 'pending',
  };

  await db.syncQueue.put(op);

  // Debounce the actual sync
  debouncedSync();
}

/**
 * Debounced sync trigger — waits 2 seconds after last change.
 */
function debouncedSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  setStatus('saving');

  syncDebounceTimer = setTimeout(async () => {
    await processSyncQueue();
  }, 2000);
}

/**
 * Process all pending sync operations.
 */
async function processSyncQueue(): Promise<void> {
  if (syncInProgress) return;
  if (!isOnline()) {
    setStatus('offline');
    return;
  }

  syncInProgress = true;
  setStatus('syncing');

  try {
    const rootFolderId = await getRootFolderId();
    if (!rootFolderId) {
      setStatus('error', 'No root folder configured');
      syncInProgress = false;
      return;
    }

    // Export full database and save to Drive
    const dbData = await exportDatabase();
    const dbJson = JSON.stringify(dbData, null, 2);

    // Find or create database.json
    const dbFile = await findFileInFolder(rootFolderId, 'database.json');
    if (dbFile) {
      await updateFile(dbFile.id, dbJson);
    } else {
      await createFile('database.json', dbJson, rootFolderId);
    }

    // Save individual pages to pages/ folder
    await syncPagesFolder(rootFolderId, dbData.pages);

    // Clear processed sync queue
    await db.syncQueue.clear();

    lastSyncTime = nowISO();
    setStatus('saved');
  } catch (error) {
    console.error('[Sync] Error:', error);
    setStatus('error', error instanceof Error ? error.message : 'Sync failed');

    // Retry failed operations with exponential backoff
    const pending = await db.syncQueue.where('status').equals('pending').toArray();
    for (const op of pending) {
      if (op.retries < op.maxRetries) {
        await db.syncQueue.update(op.id, {
          retries: op.retries + 1,
          status: 'pending',
        });
      } else {
        await db.syncQueue.update(op.id, { status: 'failed' });
      }
    }

    // Schedule retry
    const retryDelay = RETRY_DELAY_BASE * Math.pow(2, Math.min(pending[0]?.retries || 0, 5));
    setTimeout(() => processSyncQueue(), retryDelay);
  } finally {
    syncInProgress = false;
  }
}

/**
 * Sync pages to individual files in pages/ folder.
 */
async function syncPagesFolder(
  rootFolderId: string,
  pages: { id: string; content: string; title: string; notebookId: string }[]
): Promise<void> {
  // Ensure pages/ folder exists
  let pagesFolder = await findFileInFolder(rootFolderId, 'pages');
  if (!pagesFolder) {
    pagesFolder = await createFolder('pages', rootFolderId);
  }

  // Save each page with content
  for (const page of pages) {
    if (page.content) {
      const fileName = `${page.id}.json`;
      const pageData = JSON.stringify({
        id: page.id,
        title: page.title,
        content: page.content,
        notebookId: page.notebookId,
      });

      const existingFile = await findFileInFolder(pagesFolder.id, fileName);
      if (existingFile) {
        await updateFile(existingFile.id, pageData);
      } else {
        await createFile(fileName, pageData, pagesFolder.id);
      }
    }
  }
}

// ===================== SYNC FROM CLOUD =====================

/**
 * Full sync from Google Drive to local.
 * Called on login and manual "Sync Now".
 */
export async function syncFromCloud(): Promise<void> {
  if (syncInProgress) return;

  syncInProgress = true;
  setStatus('syncing');

  try {
    const rootFolderId = await getRootFolderId();
    if (!rootFolderId) {
      setStatus('idle');
      syncInProgress = false;
      return;
    }

    // Download database.json
    const dbFile = await findFileInFolder(rootFolderId, 'database.json');
    if (!dbFile) {
      console.log('[Sync] No database.json found on Drive. Starting fresh.');
      setStatus('saved');
      syncInProgress = false;
      return;
    }

    const dbContent = await downloadFile(dbFile.id);
    const dbData = JSON.parse(dbContent);

    // Load pages from pages/ folder
    const pagesFolder = await findFileInFolder(rootFolderId, 'pages');
    const pages: { id: string; title: string; content: string; notebookId: string }[] = [];

    if (pagesFolder) {
      const pageFiles = await listFiles(pagesFolder.id);
      for (const pf of pageFiles) {
        try {
          const pageContent = await downloadFile(pf.id);
          const pageData = JSON.parse(pageContent);
          pages.push(pageData);
        } catch (err) {
          console.warn(`[Sync] Failed to load page ${pf.name}:`, err);
        }
      }
    }

    // Merge data into IndexedDB
    await loadFromDatabase({
      days: dbData.days || [],
      notebooks: dbData.notebooks || [],
      pages: pages as Page[],
    });

    lastSyncTime = nowISO();
    setStatus('saved');
  } catch (error) {
    console.error('[Sync] Error syncing from cloud:', error);
    setStatus('error', error instanceof Error ? error.message : 'Sync failed');
  } finally {
    syncInProgress = false;
  }
}

/**
 * Force sync now (manual trigger).
 */
export async function forceSync(): Promise<void> {
  if (!isOnline()) {
    setStatus('offline');
    return;
  }

  // First push local changes
  await processSyncQueue();

  // Then pull cloud changes
  await syncFromCloud();
}

// ===================== ONLINE/OFFLINE DETECTION =====================

/**
 * Initialize online/offline event listeners.
 */
export function initNetworkListeners(): void {
  window.addEventListener('online', () => {
    console.log('[Sync] Network restored');
    setStatus('syncing');
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[Sync] Network lost');
    setStatus('offline');
  });

  // Set initial status
  if (!isOnline()) {
    setStatus('offline');
  }
}

/**
 * Get pending operation count.
 */
export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count();
}
