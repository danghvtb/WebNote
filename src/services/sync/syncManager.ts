// ============================================================
// MyNotes — Sync Manager
// Orchestrates local IndexedDB ↔ Google Drive synchronization.
// ============================================================

import { db } from '../database/db';
import { exportDatabase, loadFromDatabase, rebuildSearchIndex } from '../database/repository';
import {
  findFileInFolder,
  createFile,
  updateFile,
  downloadFile,
  getFileMetadata,
  createFolder,
  trashFile,
  uploadBinaryFile,
} from '../google/drive';
import { getRootFolderId } from '../google/rootFolderManager';
import { useAppStore } from '../../stores/appStore';
import type { SyncOperation, SyncStatus } from '../../types';
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

async function parseSnapshotText(raw: string): Promise<VaultSnapshot> {
  const parse = () => JSON.parse(raw) as VaultSnapshot;
  if (raw.length < 2_000_000 || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return parse();
  const workerSource = `self.onmessage = (event) => { try { self.postMessage({ ok: true, value: JSON.parse(event.data) }); } catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'JSON parse failed' }); } };`;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  try {
    return await new Promise<VaultSnapshot>((resolve, reject) => {
      const worker = new Worker(workerUrl);
      worker.onmessage = (event: MessageEvent<{ ok: boolean; value?: VaultSnapshot; error?: string }>) => {
        worker.terminate();
        if (event.data.ok && event.data.value) resolve(event.data.value);
        else reject(new Error(event.data.error || 'JSON parse failed'));
      };
      worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message || 'Snapshot worker failed')); };
      worker.postMessage(raw);
    });
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

function validateRemoteSnapshot(snapshot: VaultSnapshot & { meta?: { schemaVersion?: number } }): void {
  const collections: Array<[string, unknown]> = [
    ['days', snapshot.days], ['notebooks', snapshot.notebooks], ['pages', snapshot.pages],
    ['tags', snapshot.tags], ['projects', snapshot.projects], ['workReports', snapshot.workReports],
    ['attachments', snapshot.attachments],
  ];
  for (const [name, value] of collections) if (!Array.isArray(value)) throw new Error(`Invalid database.json: ${name} must be an array`);
  if ((snapshot.meta?.schemaVersion || 1) > 1) throw new Error('SNAPSHOT_VERSION_UNSUPPORTED');
  const assertUnique = (items: Array<{ id?: string }>, name: string) => {
    const ids = new Set<string>();
    for (const item of items) {
      if (!item?.id || ids.has(item.id)) throw new Error(`Invalid database.json: duplicate or empty ${name} id`);
      ids.add(item.id);
    }
  };
  assertUnique(snapshot.days, 'day');
  assertUnique(snapshot.notebooks, 'notebook');
  assertUnique(snapshot.pages, 'page');
  assertUnique(snapshot.tags, 'tag');
  assertUnique(snapshot.projects, 'project');
  assertUnique(snapshot.workReports, 'work report');
  assertUnique(snapshot.attachments, 'attachment');
  const dayIds = new Set(snapshot.days.map((day) => day.id));
  const notebookIds = new Set(snapshot.notebooks.map((notebook) => notebook.id));
  const pageIds = new Set(snapshot.pages.map((page) => page.id));
  for (const notebook of snapshot.notebooks) if (!dayIds.has(notebook.dateId)) throw new Error(`Invalid database.json: notebook ${notebook.id} references missing day`);
  for (const page of snapshot.pages) if (!notebookIds.has(page.notebookId)) throw new Error(`Invalid database.json: page ${page.id} references missing notebook`);
  for (const report of snapshot.workReports) if (!dayIds.has(report.dayId)) throw new Error(`Invalid database.json: report ${report.id} references missing day`);
  for (const attachment of snapshot.attachments) if (!pageIds.has(attachment.pageId)) throw new Error(`Invalid database.json: attachment ${attachment.id} references missing page`);
}

function mergePendingLocal(remote: VaultSnapshot, local: VaultSnapshot, pendingOps: SyncOperation[]): VaultSnapshot {
  const merged: VaultSnapshot = {
    ...remote,
    pages: Array.isArray(remote.pages) ? [...remote.pages] : [],
    tags: Array.isArray(remote.tags) ? [...remote.tags] : [],
    projects: Array.isArray(remote.projects) ? [...remote.projects] : [],
    workReports: Array.isArray(remote.workReports) ? [...remote.workReports] : [],
    attachments: Array.isArray(remote.attachments) ? [...remote.attachments] : [],
  };
  const collections: Record<string, keyof VaultSnapshot> = {
    day: 'days', notebook: 'notebooks', page: 'pages', tag: 'tags',
    project: 'projects', work_report: 'workReports', attachment: 'attachments',
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

  // Apply the same cascades as repository deletes so stale children from a
  // remote snapshot cannot resurrect after an offline delete.
  const deletedNotebookIds = new Set([...pending.values()].filter((op) => op.type === 'delete' && op.entity === 'notebook').map((op) => op.entityId));
  if (deletedNotebookIds.size) {
    merged.notebooks = merged.notebooks.filter((notebook) => !deletedNotebookIds.has(notebook.id));
    merged.pages = merged.pages.filter((page) => !deletedNotebookIds.has(page.notebookId));
    const removedPageIds = new Set(local.pages.filter((page) => deletedNotebookIds.has(page.notebookId)).map((page) => page.id));
    merged.attachments = merged.attachments.filter((attachment) => !removedPageIds.has(attachment.pageId));
  }
  const deletedTagIds = new Set([...pending.values()].filter((op) => op.type === 'delete' && op.entity === 'tag').map((op) => op.entityId));
  if (deletedTagIds.size) {
    merged.pages = merged.pages.map((page) => ({ ...page, tagIds: (page.tagIds || []).filter((tagId) => !deletedTagIds.has(tagId)) }));
  }
  return merged;
}

/**
 * Protect the local-first cache from an incomplete or stale cloud snapshot.
 * A valid snapshot may still be older than this browser (for example when a
 * second device has not uploaded its latest database.json yet). Never discard
 * a local record that is newer than the remote record, or that is absent from
 * the remote collection. Soft-deleted records remain part of the snapshot so
 * this also prevents an old cloud copy from resurrecting deleted content.
 */
export function mergeNewerLocalRecords(remote: VaultSnapshot, local: VaultSnapshot): {
  snapshot: VaultSnapshot;
  preserved: Array<{ entity: SyncOperation['entity']; item: { id: string } }>;
} {
  const merged: VaultSnapshot = {
    ...remote,
    days: [...(remote.days || [])],
    notebooks: [...(remote.notebooks || [])],
    pages: [...(remote.pages || [])],
    tags: [...(remote.tags || [])],
    projects: [...(remote.projects || [])],
    workReports: [...(remote.workReports || [])],
    attachments: [...(remote.attachments || [])],
    scheduleBlocks: [...(remote.scheduleBlocks || [])],
    customTasks: [...(remote.customTasks || [])],
    workCategories: [...(remote.workCategories || [])],
  };
  const preserved: Array<{ entity: SyncOperation['entity']; item: { id: string } }> = [];
  // Days do not have a standalone sync entity; still retain a local day when
  // an older snapshot omitted it, otherwise preserved notebooks would lose
  // their parent timeline record during the apply transaction.
  const remoteDays = merged.days as Array<{ id: string; updatedAt?: string; createdAt?: string }>;
  const remoteDayIds = new Set(remoteDays.map((day) => day.id));
  for (const localDay of (local.days || []) as Array<{ id: string; updatedAt?: string; createdAt?: string }>) {
    if (!remoteDayIds.has(localDay.id)) remoteDays.push(localDay);
  }
  merged.days = remoteDays;
  const collections: Array<{ entity: SyncOperation['entity']; key: keyof VaultSnapshot }> = [
    { entity: 'notebook', key: 'notebooks' },
    { entity: 'page', key: 'pages' }, { entity: 'tag', key: 'tags' },
    { entity: 'project', key: 'projects' }, { entity: 'work_report', key: 'workReports' },
    { entity: 'attachment', key: 'attachments' }, { entity: 'schedule', key: 'scheduleBlocks' },
  ];
  for (const { entity, key } of collections) {
    const remoteItems = (merged[key] || []) as Array<{ id: string; updatedAt?: string; createdAt?: string }>;
    const localItems = (local[key] || []) as Array<{ id: string; updatedAt?: string; createdAt?: string }>;
    const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
    for (const localItem of localItems) {
      const remoteItem = remoteById.get(localItem.id);
      const localTime = Date.parse(localItem.updatedAt || localItem.createdAt || '') || 0;
      const remoteTime = Date.parse(remoteItem?.updatedAt || remoteItem?.createdAt || '') || 0;
      if (!remoteItem || localTime > remoteTime) {
        const index = remoteItems.findIndex((item) => item.id === localItem.id);
        if (index >= 0) remoteItems[index] = localItem;
        else remoteItems.push(localItem);
        preserved.push({ entity, item: localItem });
      }
    }
    (merged as unknown as Record<string, unknown[]>)[key] = remoteItems;
  }
  // Schedules are an aggregate: local custom tasks/categories must travel with
  // locally newer schedule blocks to avoid a partial schedule rollback.
  if (preserved.some(({ entity }) => entity === 'schedule')) {
    merged.customTasks = [...(local.customTasks || [])];
    merged.workCategories = [...(local.workCategories || [])];
  }
  return { snapshot: merged, preserved };
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
    const { useNotesStore, useScheduleStore, useWorkReportStore } = await import('../../stores/syncRefresh');
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

  // Keep the unified search index fresh for domain collections whose mutations
  // are represented by aggregate sync operations rather than page updates.
  if (entity === 'project' || entity === 'schedule') {
    void rebuildSearchIndex().catch(() => undefined);
  }

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
    // Retry binary attachments that could not be uploaded while offline before
    // publishing the next database snapshot. The JSON snapshot remains the
    // source of truth and contains the resulting Drive file id.
    const completedAttachmentOps = new Set<string>();
    for (const op of pendingOps.filter((item) => item.entity === 'attachment' && item.type !== 'delete')) {
      const attachment = await db.attachments.get(op.entityId);
      if (!attachment?.dataUrl || attachment.driveFileId) {
        completedAttachmentOps.add(op.id);
        continue;
      }
      try {
        const response = await fetch(attachment.dataUrl);
        const driveFile = await uploadBinaryFile(attachment.name, await response.blob(), rootFolderId);
        await db.attachments.put({ ...attachment, driveFileId: driveFile.id, updatedAt: nowISO() });
        completedAttachmentOps.add(op.id);
      } catch (error) {
        console.warn('[Sync] Attachment upload deferred:', attachment.name, error);
      }
    }
    for (const op of pendingOps.filter((item) => item.entity === 'attachment' && item.type === 'delete')) {
      const attachment = await db.attachments.get(op.entityId);
      // Permanent local deletion removes the IndexedDB row before the queue is
      // drained. The queued payload therefore carries the last known Drive id.
      let queuedAttachment: { driveFileId?: string; name?: string } | undefined;
      if (op.data) {
        try { queuedAttachment = JSON.parse(op.data) as { driveFileId?: string; name?: string }; } catch { /* ignore malformed legacy payload */ }
      }
      const driveFileId = attachment?.driveFileId || queuedAttachment?.driveFileId;
      if (!driveFileId) {
        completedAttachmentOps.add(op.id);
        continue;
      }
      try {
        await trashFile(driveFileId);
        completedAttachmentOps.add(op.id);
      } catch (error) {
        console.warn('[Sync] Attachment delete deferred:', attachment?.name || queuedAttachment?.name || op.entityId, error);
      }
    }
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
    await Promise.all(pendingOps
      .filter((op) => op.entity !== 'attachment' || completedAttachmentOps.has(op.id))
      .map((op) => db.syncQueue.delete(op.id)));

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
    const remote = await parseSnapshotText(await downloadFile(fileId));
    performanceMark('cloud-snapshot-download-end');
    const remoteOwner = (remote as unknown as { meta?: { ownerEmail?: string } }).meta?.ownerEmail;
    const currentOwner = useAppStore.getState().user?.email;
    if (remoteOwner && currentOwner && remoteOwner.toLowerCase() !== currentOwner.toLowerCase()) {
      throw new Error('ACCOUNT_MISMATCH');
    }
    const local = await exportDatabase();
    if (!Array.isArray(remote.tags)) remote.tags = [];
    if (!Array.isArray(remote.projects)) remote.projects = [];
    if (!Array.isArray(remote.workReports)) remote.workReports = [];
    if (!Array.isArray(remote.pages)) remote.pages = [];
    if (!Array.isArray(remote.attachments)) remote.attachments = local.attachments;
    validateRemoteSnapshot(remote as VaultSnapshot & { meta?: { schemaVersion?: number } });

    // Snapshots created before attachment support must not erase local files.
    let pending = await db.syncQueue.where('status').equals('pending').toArray();
    const baseMerge = mergeNewerLocalRecords(remote as VaultSnapshot, local);
    const pendingKeys = new Set(pending.map((operation) => `${operation.entity}:${operation.entityId}`));
    // If an older app/version failed to enqueue a local mutation, recreate a
    // pending operation before applying the cloud snapshot. This makes the
    // protection durable and lets the normal upload path reconcile it later.
    for (const { entity, item } of baseMerge.preserved) {
      const key = `${entity}:${item.id}`;
      if (!pendingKeys.has(key)) {
        await queueSync('update', entity, item.id, item);
        pendingKeys.add(key);
      }
    }
    pending = await db.syncQueue.where('status').equals('pending').toArray();
    const merged = mergePendingLocal(baseMerge.snapshot, local, pending);
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
