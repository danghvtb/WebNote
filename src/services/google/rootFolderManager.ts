// ============================================================
// MyNotes — Root Folder Manager
// CRITICAL SERVICE: Ensures a single "MyNotes" folder exists
// in the user's Google Drive. Never creates duplicates.
// ============================================================

import {
  findFolders,
  createFolder,
  fileExists,
  findFileInFolder,
} from './drive';
import { db } from '../database/db';

const ROOT_FOLDER_NAME = 'MyNotes';

export type RootFolderResult =
  | { status: 'found'; folderId: string }
  | { status: 'not_found' }
  | { status: 'multiple'; folders: { id: string; hasDatabase: boolean; modifiedTime?: string }[] }
  | { status: 'error'; error: string };

/**
 * Ensure we have a valid root folder.
 * Follows the 3-step detection process:
 *
 * Step 1: Check local cache (IndexedDB) for rootFolderId
 *         → If found and still exists on Drive → use it
 *
 * Step 2: Search Google Drive for existing "MyNotes" folder
 *         → If found → cache and use it
 *         → If multiple found → pick best candidate
 *
 * Step 3: Only if no folder exists → return 'not_found'
 *         (Caller must confirm with user before creating)
 *
 * NEVER auto-creates a folder. The UI must ask the user first.
 */
export async function ensureRootFolder(): Promise<RootFolderResult> {
  try {
    // ── Step 1: Check local cache ──
    const cachedFolderId = await getCachedRootFolderId();
    if (cachedFolderId) {
      console.log('[RootFolder] Found cached rootFolderId:', cachedFolderId);
      const exists = await fileExists(cachedFolderId);
      if (exists) {
        console.log('[RootFolder] Cached folder verified on Drive');
        return { status: 'found', folderId: cachedFolderId };
      }
      console.warn('[RootFolder] Cached folder no longer exists on Drive');
      await clearCachedRootFolderId();
    }

    // ── Step 2: Search Google Drive ──
    console.log('[RootFolder] Searching Google Drive for "MyNotes" folder...');
    const folders = await findFolders(ROOT_FOLDER_NAME);

    if (folders.length === 0) {
      // ── Step 3: No folder found ──
      console.log('[RootFolder] No MyNotes folder found on Drive');
      return { status: 'not_found' };
    }

    if (folders.length === 1) {
      // Single folder found — use it
      const folderId = folders[0].id;
      console.log('[RootFolder] Found single MyNotes folder:', folderId);
      await saveCachedRootFolderId(folderId);
      return { status: 'found', folderId };
    }

    // Multiple folders found — pick the best one
    console.warn(`[RootFolder] Found ${folders.length} MyNotes folders. Evaluating...`);
    return await handleMultipleFolders(folders);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[RootFolder] Error:', msg);
    return { status: 'error', error: msg };
  }
}

/**
 * Handle the case where multiple "MyNotes" folders exist.
 * Priority:
 * 1. Folder containing a valid database.json file
 * 2. Most recently modified folder
 */
async function handleMultipleFolders(
  folders: { id: string; modifiedTime?: string }[]
): Promise<RootFolderResult> {
  const evaluated: { id: string; hasDatabase: boolean; modifiedTime?: string }[] = [];

  for (const folder of folders) {
    try {
      const dbFile = await findFileInFolder(folder.id, 'database.json');
      evaluated.push({
        id: folder.id,
        hasDatabase: !!dbFile,
        modifiedTime: folder.modifiedTime,
      });
    } catch {
      evaluated.push({
        id: folder.id,
        hasDatabase: false,
        modifiedTime: folder.modifiedTime,
      });
    }
  }

  // Check if exactly one has a database
  const withDb = evaluated.filter((f) => f.hasDatabase);
  if (withDb.length === 1) {
    console.log('[RootFolder] One folder has database.json, using it:', withDb[0].id);
    await saveCachedRootFolderId(withDb[0].id);
    return { status: 'found', folderId: withDb[0].id };
  }

  // If multiple have databases or none do, return multiple for user to choose
  // But auto-select the most recently modified one as default
  if (withDb.length === 0) {
    // No database files — pick most recent
    const sorted = [...evaluated].sort((a, b) => {
      const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return bTime - aTime;
    });
    const best = sorted[0];
    console.log('[RootFolder] No databases found, using most recent:', best.id);
    await saveCachedRootFolderId(best.id);
    return { status: 'found', folderId: best.id };
  }

  // Multiple folders with databases — let user choose
  return { status: 'multiple', folders: evaluated };
}

/**
 * Create a new root folder (only called after user confirmation).
 */
export async function createRootFolder(): Promise<string> {
  console.log('[RootFolder] Creating new MyNotes folder...');
  const folder = await createFolder(ROOT_FOLDER_NAME);
  const folderId = folder.id;
  await saveCachedRootFolderId(folderId);
  console.log('[RootFolder] Created MyNotes folder:', folderId);
  return folderId;
}

/**
 * Validate that a folder ID is still valid.
 */
export async function validateRootFolder(folderId: string): Promise<boolean> {
  try {
    return await fileExists(folderId);
  } catch {
    return false;
  }
}

// ===================== LOCAL CACHE =====================

const ROOT_FOLDER_KEY = 'rootFolderId';

async function getCachedRootFolderId(): Promise<string | null> {
  try {
    const record = await db.appState.get(ROOT_FOLDER_KEY);
    return record?.value || null;
  } catch {
    // Fallback to localStorage
    return localStorage.getItem('mynotes_rootFolderId');
  }
}

async function saveCachedRootFolderId(folderId: string): Promise<void> {
  try {
    await db.appState.put({ key: ROOT_FOLDER_KEY, value: folderId });
  } catch {
    // Fallback to localStorage
    localStorage.setItem('mynotes_rootFolderId', folderId);
  }
}

async function clearCachedRootFolderId(): Promise<void> {
  try {
    await db.appState.delete(ROOT_FOLDER_KEY);
  } catch {
    localStorage.removeItem('mynotes_rootFolderId');
  }
}

/**
 * Get the current cached root folder ID (without validation).
 */
export async function getRootFolderId(): Promise<string | null> {
  return getCachedRootFolderId();
}
