// ============================================================
// MyNotes — Sync Manager
// Orchestrates local IndexedDB ↔ Google Drive ↔ Supabase synchronization.
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
  trashFile,
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

// ── Sync Guard: Block all push operations until initial pull is complete ──
let initialPullComplete = false;
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

/**
 * Check if the initial cloud pull has completed.
 * Returns false during login/session-restore until syncFromCloud finishes.
 */
export function isInitialPullComplete(): boolean {
  return initialPullComplete;
}

/**
 * Mark the initial pull as complete — enables push operations.
 */
export function markInitialPullComplete(): void {
  initialPullComplete = true;
}

/**
 * Reset pull state — call on logout or account switch.
 */
export function resetInitialPullState(): void {
  initialPullComplete = false;
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

// ===================== STORE REFRESH HELPER =====================

/**
 * Refresh active Zustand stores (notesStore & scheduleStore)
 * and auto-select active or recent notebook/day after data changes/sync.
 */
export async function refreshActiveNotesStore(): Promise<void> {
  try {
    const { useNotesStore } = await import('../../stores/notesStore');
    const { useScheduleStore } = await import('../../stores/scheduleStore');
    const notesStore = useNotesStore.getState();

    await notesStore.loadDays();
    await notesStore.loadRecentNotebooks();
    await useScheduleStore.getState().loadAllBlocks();
    await useScheduleStore.getState().loadTasksAndCategories();

    const { selectedDayId, selectedNotebookId, recentNotebooks, days } = notesStore;

    // Refresh active day's notebooks list
    if (selectedDayId) {
      await notesStore.loadNotebooksByDay(selectedDayId);
    }

    // Refresh active notebook's pages list
    if (selectedNotebookId) {
      await notesStore.loadPagesByNotebook(selectedNotebookId);
    }

    // If no notebook is currently selected, select the most recent notebook
    if (!selectedNotebookId && recentNotebooks.length > 0) {
      await notesStore.selectNotebook(recentNotebooks[0].id);
    } else if (!selectedDayId && days.length > 0) {
      notesStore.selectDay(days[0].id);
    }
  } catch (err) {
    console.warn('[Sync] Active notes store refresh error:', err);
  }
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
  // When deleting an entity, clear any previous pending operations for this entityId
  // to avoid zombie updates resurrecting a deleted item
  if (type === 'delete') {
    const staleOps = await db.syncQueue.where('entityId').equals(entityId).toArray().catch(() => []);
    for (const stale of staleOps) {
      await db.syncQueue.delete(stale.id).catch(() => {});
    }
  }

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

  // ── SYNC GUARD: Do NOT push to cloud until initial pull finishes ──
  if (!initialPullComplete) {
    console.log('[Sync] Initial pull not complete yet — queued locally, skipping push.');
    return;
  }

  if (type === 'delete') {
    // Immediate async sync for deletions (non-blocking)
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    setStatus('saving');
    triggerSync().catch((err) => console.warn('[Sync] Delete trigger error:', err));
  } else {
    debouncedSync();
  }
}

/**
 * Debounced sync trigger — waits 1 second after last change.
 */
function debouncedSync(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  setStatus('saving');

  syncDebounceTimer = setTimeout(() => {
    triggerSync().catch((err) => console.warn('[Sync] Debounced sync error:', err));
  }, 1000);
}

/**
 * Unified trigger for active cloud sync provider or local fallback.
 */
export async function triggerSync(): Promise<void> {
  // ── SYNC GUARD: Block push until initial pull is done ──
  if (!initialPullComplete) {
    console.log('[Sync] triggerSync blocked — initial pull not complete.');
    return;
  }

  if (!isOnline()) {
    setStatus('offline');
    return;
  }

  // 1. Try Supabase Sync first if configured
  try {
    const { isSupabaseConfigured, supabase } = await import('../supabase/supabaseClient');
    if (isSupabaseConfigured() && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { pushToSupabase } = await import('../supabase/supabaseSync');
        await pushToSupabase();
        return;
      }
    }
  } catch (err) {
    console.warn('[Sync] Supabase trigger check:', err);
  }

  // 2. Try Google Drive Sync if configured
  try {
    const rootFolderId = await getRootFolderId();
    if (rootFolderId) {
      await processGoogleSyncQueue();
      return;
    }
    const { ensureRootFolder } = await import('../google/rootFolderManager');
    const folderRes = await ensureRootFolder();
    if (folderRes.status === 'found') {
      await processGoogleSyncQueue();
      return;
    }
  } catch (err) {
    console.warn('[Sync] Google Drive trigger check:', err);
  }

  // 3. Fallback: Local offline mode (Data saved in IndexedDB)
  await db.syncQueue.clear();
  lastSyncTime = nowISO();
  setStatus('saved');
}

/**
 * Process all pending sync operations (Google Drive).
 */
export async function processGoogleSyncQueue(): Promise<void> {
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
        await db.syncQueue.clear();
        lastSyncTime = nowISO();
        setStatus('saved');
        syncInProgress = false;
        return;
      }
    }

    // Check pending operations to optimize sync
    const pendingOps = await db.syncQueue.where('status').equals('pending').toArray();
    const updatedPageIds = new Set<string>();
    const deletedPageIds: string[] = [];

    for (const op of pendingOps) {
      if (op.entity === 'page' && op.type === 'update') {
        updatedPageIds.add(op.entityId);
      } else if (op.entity === 'page' && op.type === 'delete') {
        deletedPageIds.push(op.entityId);
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

    // Trash deleted pages from Google Drive pages/ folder
    if (deletedPageIds.length > 0) {
      const pagesFolderId = await getCachedFileId(rootFolderId, 'pages');
      if (pagesFolderId) {
        for (const pId of deletedPageIds) {
          const fileId = await getCachedFileId(pagesFolderId, `${pId}.json`);
          if (fileId) {
            await trashFile(fileId).catch((err) => console.warn(`[Sync] Could not trash deleted page ${pId}:`, err));
            fileIdCache.delete(`${pagesFolderId}/${pId}.json`);
          }
        }
      }
    }

    // Incremental page sync: Only sync individual pages that were actually updated/created
    // Never re-sync all other unchanged pages just because one page was deleted!
    const pagesToSync = dbData.pages.filter((p) => updatedPageIds.has(p.id));

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
    setTimeout(() => processGoogleSyncQueue(), retryDelay);
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
 * Called on login, connect, and manual "Sync Now".
 */
export async function syncFromCloud(options?: { isConnectOrLogin?: boolean }): Promise<void> {
  if (syncInProgress) return;

  // On login or connect: wipe local cache first so no stale local data is pushed up
  if (options?.isConnectOrLogin) {
    try {
      const { clearAllLocalData } = await import('../database/repository');
      await clearAllLocalData();
    } catch (err) {
      console.warn('[Sync] Failed to clear local cache before connect pull:', err);
    }
  } else {
    // During active session: process pending local sync queue first
    try {
      const pendingCount = await db.syncQueue.where('status').equals('pending').count();
      if (pendingCount > 0) {
        await triggerSync();
      }
    } catch (err) {
      console.warn('[Sync] Failed to process pending queue before pull:', err);
    }
  }

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
      scheduleBlocks: dbData.scheduleBlocks || [],
      customTasks: dbData.customTasks || [],
      workCategories: dbData.workCategories || [],
    });

    // Refresh UI immediately so user isn't stuck waiting
    await refreshActiveNotesStore();

    // 2. PARALLEL BACKGROUND PATH: Check pages/ folder for any extra/newer page files in parallel batches
    const pagesFolder = await getCachedFileId(rootFolderId, 'pages');
    if (pagesFolder) {
      const pageFiles = await listFiles(pagesFolder);
      const activePageIds = new Set(
        dbData.pages?.filter((p: Page) => !p.deleted).map((p: Page) => p.id) || []
      );

      // Download page files in parallel batches of 5
      const BATCH_SIZE = 5;
      let hasUpdates = false;

      for (let i = 0; i < pageFiles.length; i += BATCH_SIZE) {
        const batch = pageFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (pf) => {
            try {
              const pageIdFromFilename = pf.name.replace('.json', '');
              // If database.json had pages defined, but this file is NOT in activePageIds, it was deleted!
              if (dbData.pages && !activePageIds.has(pageIdFromFilename)) {
                // Silently trash orphaned deleted page from Drive
                trashFile(pf.id).catch(() => {});
                return;
              }

              const pageContent = await downloadFile(pf.id);
              const pageData = JSON.parse(pageContent);
              if (pageData && pageData.id) {
                if (dbData.pages && !activePageIds.has(pageData.id)) {
                  trashFile(pf.id).catch(() => {});
                  return;
                }
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
          scheduleBlocks: dbData.scheduleBlocks || [],
          customTasks: dbData.customTasks || [],
          workCategories: dbData.workCategories || [],
        });

        // Final UI refresh
        await refreshActiveNotesStore();
      }
    }

    lastSyncTime = nowISO();
    setStatus('saved');

    // Refresh active notesStore state after cloud sync
    await refreshActiveNotesStore();

    // ── Mark initial pull as complete — push operations are now allowed ──
    if (options?.isConnectOrLogin) {
      initialPullComplete = true;
      console.log('[Sync] Initial pull complete — push operations enabled.');
    }
  } catch (error) {
    console.error('[Sync] Error syncing from cloud:', error);
    setStatus('error', error instanceof Error ? error.message : 'Sync failed');

    // Even on error, allow push after login attempt so app is usable
    if (options?.isConnectOrLogin) {
      initialPullComplete = true;
      console.warn('[Sync] Initial pull failed but enabling push to avoid deadlock.');
    }
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
  await triggerSync();

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
    triggerSync();
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
