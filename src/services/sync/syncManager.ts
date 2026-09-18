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
  getFileMetadata,
  createFolder,
  listFiles,
  trashFile,
} from '../google/drive';
import { getRootFolderId } from '../google/rootFolderManager';
import { useAppStore } from '../../stores/appStore';
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
const DATABASE_METADATA_KEY = 'sync.database.metadata';

function performanceMark(name: string): void {
  if (typeof performance !== 'undefined') performance.mark(`mynotes:${name}`);
}

interface CachedDatabaseMetadata {
  ownerEmail?: string;
  rootFolderId: string;
  databaseFileId: string;
  modifiedTime?: string;
  version?: string;
  size?: string;
  md5Checksum?: string;
  snapshotId?: string;
  snapshotAppliedAt: number;
}

async function getCachedDatabaseMetadata(): Promise<CachedDatabaseMetadata | null> {
  const record = await db.appState.get(DATABASE_METADATA_KEY);
  if (!record?.value) return null;
  try { return JSON.parse(record.value) as CachedDatabaseMetadata; } catch { return null; }
}

async function saveDatabaseMetadata(metadata: CachedDatabaseMetadata): Promise<void> {
  await db.appState.put({ key: DATABASE_METADATA_KEY, value: JSON.stringify(metadata) });
}

function updateRuntime(partial: Record<string, unknown>): void {
  const store = useAppStore.getState();
  if (partial.cloudBootstrapStatus) store.setCloudBootstrapStatus(partial.cloudBootstrapStatus as Parameters<typeof store.setCloudBootstrapStatus>[0]);
  if (partial.pushAllowed !== undefined) store.setPushAllowed(Boolean(partial.pushAllowed));
  if (partial.searchIndexStatus) store.setSearchIndexStatus(partial.searchIndexStatus as Parameters<typeof store.setSearchIndexStatus>[0]);
}

type VaultSnapshot = Awaited<ReturnType<typeof exportDatabase>>;

function mergePendingLocal(remote: VaultSnapshot, local: VaultSnapshot, pendingOps: SyncOperation[]): VaultSnapshot {
  const merged: VaultSnapshot = {
    ...remote,
    pages: Array.isArray(remote.pages) ? [...remote.pages] : [],
    tags: Array.isArray(remote.tags) ? [...remote.tags] : [],
    projects: Array.isArray(remote.projects) ? [...remote.projects] : [],
    workReports: Array.isArray(remote.workReports) ? [...remote.workReports] : [],
  };
  const collections: Record<string, keyof VaultSnapshot> = {
    day: 'days', notebook: 'notebooks', page: 'pages', tag: 'tags',
    project: 'projects', work_report: 'workReports',
  };
  const pending = new Map<string, SyncOperation>();
  for (const op of pendingOps) pending.set(`${op.entity}:${op.entityId}`, op);
  for (const op of pending.values()) {
    if (op.entity === 'schedule') {
      merged.scheduleBlocks = local.scheduleBlocks;
      merged.customTasks = local.customTasks;
      merged.workCategories = local.workCategories;
      continue;
    }
    const field = collections[op.entity];
    if (!field) continue;
    const remoteItems = (merged[field] || []) as Array<{ id: string }>;
    if (op.type === 'delete') {
      (merged as unknown as Record<string, Array<{ id: string }>>)[field] = remoteItems.filter((item) => item.id !== op.entityId);
      continue;
    }
    const localItems = ((local[field] || []) as Array<{ id: string }>);
    const localItem = localItems.find((item) => item.id === op.entityId);
    if (!localItem) continue;
    const existingIndex = remoteItems.findIndex((item) => item.id === op.entityId);
    if (existingIndex >= 0) remoteItems[existingIndex] = localItem;
    else remoteItems.push(localItem);
    (merged as unknown as Record<string, Array<{ id: string }>>)[field] = remoteItems;
  }
  return merged;
}

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
  updateRuntime({ pushAllowed: true });
}

/**
 * Reset pull state — call on logout or account switch.
 */
export function resetInitialPullState(): void {
  initialPullComplete = false;
  updateRuntime({ pushAllowed: false });
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
    const { useWorkReportStore } = await import('../../stores/workReportStore');
    const notesStore = useNotesStore.getState();

    await notesStore.loadDays();
    await notesStore.loadRecentNotebooks();
    await useScheduleStore.getState().loadAllBlocks();
    await useScheduleStore.getState().loadTasksAndCategories();
    await useWorkReportStore.getState().loadProjects();

    const { selectedDayId, selectedNotebookId, recentNotebooks, days } = notesStore;

    // Refresh active day's notebooks list
    if (selectedDayId) {
      await notesStore.loadNotebooksByDay(selectedDayId);
      await useWorkReportStore.getState().loadReportForDay(selectedDayId);
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
 * Unified trigger for Google Drive sync or local fallback.
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

  // Try Google Drive Sync if a folder is available.
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
    if ((err as { status?: number })?.status === 401 || (err instanceof Error && err.message === 'AUTH_REQUIRED')) {
      setStatus('auth_required', 'Phiên Google Drive cần được kết nối lại.');
      return;
    }
  }

  // Fallback: Local offline mode (data remains in IndexedDB).
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
    const dbData = {
      ...(await exportDatabase()),
      meta: {
        schemaVersion: 1,
        snapshotId: generateId('snapshot'),
        generatedAt: nowISO(),
        ownerEmail: useAppStore.getState().user?.email,
      },
    };
    const dbJson = JSON.stringify(dbData);

    // Save/update database.json using cache
    let dbFileId = await getCachedFileId(rootFolderId, 'database.json');
    let uploadedMetadata: { id: string; modifiedTime?: string; size?: string; version?: string; md5Checksum?: string } | null = null;
    if (dbFileId) {
      uploadedMetadata = await updateFile(dbFileId, dbJson);
    } else {
      const created = await createFile('database.json', dbJson, rootFolderId);
      fileIdCache.set(`${rootFolderId}/database.json`, created.id);
      dbFileId = created.id;
      uploadedMetadata = created;
    }

    await saveDatabaseMetadata({
      ownerEmail: useAppStore.getState().user?.email,
      rootFolderId,
      databaseFileId: dbFileId,
      modifiedTime: uploadedMetadata?.modifiedTime,
      version: uploadedMetadata?.version,
      size: uploadedMetadata?.size,
      md5Checksum: uploadedMetadata?.md5Checksum,
      snapshotId: dbData.meta.snapshotId,
      snapshotAppliedAt: Date.now(),
    });

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

    // Clear only the operations included in this snapshot. Edits made while
    // the upload was in flight must remain queued for the next pass.
    await Promise.all(pendingOps.map((op) => db.syncQueue.delete(op.id)));

    lastSyncTime = nowISO();
    setStatus('saved');
  } catch (error) {
    console.error('[Sync] Error:', error);
    if ((error as { status?: number })?.status === 401 || (error instanceof Error && error.message === 'AUTH_REQUIRED')) {
      setStatus('auth_required', 'Phiên Google Drive cần được kết nối lại.');
      return;
    }
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
  pages: { id: string; content: string; title: string; notebookId: string; tagIds?: string[] }[]
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
          tagIds: page.tagIds || [],
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
/**
 * Local-first cloud bootstrap. The root snapshot is authoritative; individual
 * page files are deliberately not scanned on startup.
 */
export async function syncFromCloud(options?: { isConnectOrLogin?: boolean }): Promise<void> {
  void options;
  if (syncInProgress) return;
  performanceMark('cloud-bootstrap-start');
  initialPullComplete = false;
  syncInProgress = true;
  setStatus('syncing', 'Đang kiểm tra Google Drive...');
  updateRuntime({ cloudBootstrapStatus: 'checking', pushAllowed: false });

  try {
    const rootFolderId = await getRootFolderId();
    if (!rootFolderId) {
      markInitialPullComplete();
      setStatus('saved');
      updateRuntime({ cloudBootstrapStatus: 'ready', pushAllowed: true });
      return;
    }

    const cached = await getCachedDatabaseMetadata();
    let fileId = cached?.rootFolderId === rootFolderId ? cached.databaseFileId : null;
    let remoteFile: { id: string; name: string; modifiedTime?: string; size?: string; version?: string; md5Checksum?: string } | null = null;

    if (fileId) {
      try {
        remoteFile = await getFileMetadata(fileId, 'id,name,mimeType,modifiedTime,size,version,md5Checksum,trashed');
        if ((remoteFile as unknown as { trashed?: boolean }).trashed) remoteFile = null;
      } catch (error) {
        if ((error as { status?: number })?.status !== 404) throw error;
        fileId = null;
      }
    }

    if (!remoteFile) {
      remoteFile = await findFileInFolder(rootFolderId, 'database.json');
      if (remoteFile) fileId = remoteFile.id;
    }

    if (!remoteFile || !fileId) {
      // A cached folder can be deleted or moved. Rediscover it once before
      // treating the account as a brand-new vault.
      if (cached?.rootFolderId === rootFolderId) {
        const { clearRootFolderCache, ensureRootFolder } = await import('../google/rootFolderManager');
        await clearRootFolderCache();
        const recovered = await ensureRootFolder();
        if (recovered.status === 'found' && recovered.folderId !== rootFolderId) {
          remoteFile = await findFileInFolder(recovered.folderId, 'database.json');
          if (remoteFile) fileId = remoteFile.id;
        }
      }
    }

    if (!remoteFile || !fileId) {
      markInitialPullComplete();
      setStatus('saved', 'Chưa có database.json trên Google Drive.');
      updateRuntime({ cloudBootstrapStatus: 'ready', pushAllowed: true });
      return;
    }

    if (cached && cached.databaseFileId === fileId &&
      cached.modifiedTime === remoteFile.modifiedTime &&
      (!cached.version || !remoteFile.version || cached.version === remoteFile.version)) {
      fileIdCache.set(`${rootFolderId}/database.json`, fileId);
      markInitialPullComplete();
      lastSyncTime = nowISO();
      setStatus('saved');
      updateRuntime({ cloudBootstrapStatus: 'ready', pushAllowed: true });
      if (await db.syncQueue.where('status').equals('pending').count()) setTimeout(() => processGoogleSyncQueue(), 0);
      return;
    }

    updateRuntime({ cloudBootstrapStatus: 'downloading' });
    performanceMark('cloud-snapshot-download-start');
    const remote = JSON.parse(await downloadFile(fileId)) as VaultSnapshot;
    performanceMark('cloud-snapshot-download-end');
    const remoteOwner = (remote as unknown as { meta?: { ownerEmail?: string } }).meta?.ownerEmail;
    const currentOwner = useAppStore.getState().user?.email;
    if (remoteOwner && currentOwner && remoteOwner.toLowerCase() !== currentOwner.toLowerCase()) {
      throw new Error('ACCOUNT_MISMATCH');
    }
    if (!Array.isArray(remote.days) || !Array.isArray(remote.notebooks)) {
      throw new Error('Invalid database.json snapshot');
    }
    if (!Array.isArray(remote.pages)) remote.pages = [];

    const local = await exportDatabase();
    const pending = await db.syncQueue.where('status').equals('pending').toArray();
    const merged = mergePendingLocal(remote, local, pending);
    updateRuntime({ cloudBootstrapStatus: 'applying', searchIndexStatus: 'building' });
    performanceMark('cloud-snapshot-apply-start');
    await loadFromDatabase(merged);
    await refreshActiveNotesStore();
    performanceMark('cloud-snapshot-apply-end');
    await saveDatabaseMetadata({
      ownerEmail: useAppStore.getState().user?.email,
      rootFolderId,
      databaseFileId: fileId,
      modifiedTime: remoteFile.modifiedTime,
      version: remoteFile.version,
      size: remoteFile.size,
      md5Checksum: remoteFile.md5Checksum,
      snapshotId: (remote as unknown as { meta?: { snapshotId?: string } }).meta?.snapshotId,
      snapshotAppliedAt: Date.now(),
    });

    markInitialPullComplete();
    lastSyncTime = nowISO();
    setStatus('saved');
    updateRuntime({ cloudBootstrapStatus: 'ready', pushAllowed: true, searchIndexStatus: 'ready' });
    performanceMark('cloud-bootstrap-end');
    if (pending.length) setTimeout(() => processGoogleSyncQueue(), 0);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || (error instanceof Error && error.message === 'AUTH_REQUIRED')) {
      setStatus('auth_required', 'Phiên Google Drive cần được kết nối lại.');
      updateRuntime({ cloudBootstrapStatus: 'auth_required', pushAllowed: false });
    } else {
      setStatus(isOnline() ? 'error' : 'offline', error instanceof Error ? error.message : 'Sync failed');
      updateRuntime({ cloudBootstrapStatus: isOnline() ? 'error' : 'offline', pushAllowed: false });
    }
  } finally {
    syncInProgress = false;
  }
}

export async function syncFromCloudLegacy(options?: { isConnectOrLogin?: boolean }): Promise<void> {
  if (syncInProgress) return;

  // On login or connect: wipe local cache first so no stale local data is pushed up
  if (options?.isConnectOrLogin) {
    try {
      // Legacy entry point intentionally retains local data; callers use the
      // local-first bootstrap above for all new sessions.
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
      tags: dbData.tags || [],
      projects: dbData.projects || [],
      workReports: dbData.workReports || [],
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
          tags: dbData.tags || [],
          projects: dbData.projects || [],
          workReports: dbData.workReports || [],
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
    if ((error as { status?: number })?.status === 401 || (error instanceof Error && error.message === 'AUTH_REQUIRED')) {
      setStatus('auth_required', 'Phiên Google Drive cần được kết nối lại.');
      if (options?.isConnectOrLogin) initialPullComplete = true;
      return;
    }
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

  // Pull/merge first so a reconnect cannot overwrite changes made by another
  // device. The bootstrap drains the pending queue after applying the snapshot.
  await syncFromCloud();
  if (isInitialPullComplete()) await triggerSync();
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
