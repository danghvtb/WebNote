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

// File ID Cache to prevent expensive findFileInFolder network calls
const fileIdCache = new Map<string, string>();

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

// Helper to get or find file ID with caching
async function getCachedFileId(parentFolderId: string, fileName: string): Promise<string | null> {
  const cacheKey = `${parentFolderId}/${fileName}`;
  if (fileIdCache.has(cacheKey)) {
    return fileIdCache.get(cacheKey)!;
  }
  const file = await findFileInFolder(parentFolderId, fileName);
  if (file) {
    fileIdCache.set(cacheKey, file.id);
    return file.id;
  }
  return null;
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

  // Debounce the actual sync (reduced from 2s to 1s for fast feel)
  debouncedSync();
}

/**
 * Debounced sync trigger — waits 1 second after last change.
 */
function debouncedSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  setStatus('saving');

  syncDebounceTimer = setTimeout(async () => {
    await processSyncQueue();
  }, 1000);
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
    let rootFolderId = await getRootFolderId();
    if (!rootFolderId) {
      const { ensureRootFolder } = await import('../google/rootFolderManager');
      const folderRes = await ensureRootFolder();
      if (folderRes.status === 'found') {
        rootFolderId = folderRes.folderId;
      } else {
        setStatus('error', 'No root folder configured');
        syncInProgress = false;
        return;
      }
    }

    // Check pending operations to optimize sync
    const pendingOps = await db.syncQueue.where('status').equals('pending').toArray();
    const updatedPageIds = new Set<string>();
    let structureChanged = false;

    for (const op of pendingOps) {
      if (op.entity === 'page' && op.type === 'update') {
        updatedPageIds.add(op.entityId);
      } else {
        structureChanged = true;
      }
    }

    // Export full database for root database.json
    const dbData = await exportDatabase();
    const dbJson = JSON.stringify(dbData);

    // Save/update database.json using cache
    let dbFileId = await getCachedFileId(rootFolderId, 'database.json');
    if (dbFileId) {
      await updateFile(dbFileId, dbJson);
    } else {
      const created = await createFile('database.json', dbJson, rootFolderId);
      fileIdCache.set(`${rootFolderId}/database.json`, created.id);
    }

    // Incremental page sync: Only sync pages that changed if structure didn't radically change,
    // or sync all modified pages in parallel batches
    const pagesToSync = structureChanged
      ? dbData.pages
      : dbData.pages.filter((p) => updatedPageIds.has(p.id));

    if (pagesToSync.length > 0) {
      await syncPagesFolderIncremental(rootFolderId, pagesToSync);
    }

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
 * Fast Parallel Incremental Page Sync
 */
async function syncPagesFolderIncremental(
  rootFolderId: string,
  pages: { id: string; content: string; title: string; notebookId: string }[]
): Promise<void> {
  let pagesFolderId = await getCachedFileId(rootFolderId, 'pages');
  if (!pagesFolderId) {
    const createdFolder = await createFolder('pages', rootFolderId);
    pagesFolderId = createdFolder.id;
    fileIdCache.set(`${rootFolderId}/pages`, pagesFolderId);
  }

  // Execute page updates in parallel batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (page) => {
        if (!page.content) return;
        const fileName = `${page.id}.json`;
        const pageData = JSON.stringify({
          id: page.id,
          title: page.title,
          content: page.content,
          notebookId: page.notebookId,
        });

        const fileId = await getCachedFileId(pagesFolderId!, fileName);
        if (fileId) {
          await updateFile(fileId, pageData);
        } else {
          const created = await createFile(fileName, pageData, pagesFolderId!);
          fileIdCache.set(`${pagesFolderId}/${fileName}`, created.id);
        }
      })
    );
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

    // 1. FAST PATH: Immediately render days, notebooks, and pages from database.json!
    // This makes the UI populate in under 1 second instead of waiting 15-20 seconds.
    const pagesMap = new Map<string, Page>();

    if (dbData.pages && Array.isArray(dbData.pages)) {
      dbData.pages.forEach((p: Page) => {
        if (p && p.id) {
          pagesMap.set(p.id, p);
        }
      });
    }

    // Immediately load database.json content to IndexedDB and refresh Store
    await loadFromDatabase({
      days: dbData.days || [],
      notebooks: dbData.notebooks || [],
      pages: Array.from(pagesMap.values()),
    });

    // Refresh UI immediately so user isn't stuck waiting
    try {
      const { useNotesStore } = await import('../../stores/notesStore');
      const notesStore = useNotesStore.getState();
      await notesStore.loadDays();
      await notesStore.loadRecentNotebooks();
    } catch (err) {
      console.warn('[Sync] Fast refresh warning:', err);
    }

    // 2. PARALLEL BACKGROUND PATH: Check pages/ folder for any extra/newer page files in parallel batches
    const pagesFolder = await getCachedFileId(rootFolderId, 'pages');
    if (pagesFolder) {
      const pageFiles = await listFiles(pagesFolder);
      
      // Download page files in parallel batches of 5
      const BATCH_SIZE = 5;
      let hasUpdates = false;

      for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
        const batch = pageFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (pf) => {
            try {
              const pageContent = await downloadFile(pf.id);
              const pageData = JSON.parse(pageContent);
              if (pageData && pageData.id) {
                const existing = pagesMap.get(pageData.id);
                pagesMap.set(pageData.id, {
                  ...existing,
                  ...pageData,
                });
                hasUpdates = true;
              }
            } catch (err) {
              console.warn(`[Sync] Failed to load page ${pf.name}:`, err);
            }
          })
        );
      }

      if (hasUpdates) {
        const finalPages = Array.from(pagesMap.values());
        await loadFromDatabase({
          days: dbData.days || [],
          notebooks: dbData.notebooks || [],
          pages: finalPages,
        });

        // Final UI refresh
        try {
          const { useNotesStore } = await import('../../stores/notesStore');
          const notesStore = useNotesStore.getState();
          await notesStore.loadDays();
          await notesStore.loadRecentNotebooks();
        } catch (err) {
          console.warn('[Sync] Final refresh warning:', err);
        }
      }
    }

    lastSyncTime = nowISO();
    setStatus('saved');

    // Refresh active notesStore state after cloud sync
    try {
      const { useNotesStore } = await import('../../stores/notesStore');
      const notesStore = useNotesStore.getState();
      await notesStore.loadDays();
      await notesStore.loadRecentNotebooks();
    } catch (err) {
      console.warn('[Sync] Failed to refresh notes store after cloud sync:', err);
    }

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
