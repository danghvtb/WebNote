// ============================================================
// MyNotes — Supabase Sync Service
// Handles cloud synchronization with Supabase Storage/Database
// with automatic 24/7 background session refresh.
// ============================================================

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { exportDatabase, loadFromDatabase } from '../database/repository';
import { db } from '../database/db';
import type { SyncStatus } from '../../types';
import { nowISO, isOnline } from '../../utils';

type SyncListener = (status: SyncStatus, message?: string) => void;
const listeners: Set<SyncListener> = new Set();

let currentStatus: SyncStatus = 'idle';
let lastSyncTime: string | null = null;
let syncInProgress = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function getLastSyncTime(): string | null {
  return lastSyncTime;
}

function setStatus(status: SyncStatus, message?: string): void {
  currentStatus = status;
  listeners.forEach((l) => l(status, message));
}

// Queue a local mutation to be pushed to cloud
export async function queueSync(): Promise<void> {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  setStatus('saving');

  syncDebounceTimer = setTimeout(async () => {
    await pushToSupabase();
  }, 1000);
}

// Push local Dexie IndexedDB state to Supabase Storage
export async function pushToSupabase(): Promise<void> {
  if (syncInProgress) return;
  if (!isOnline()) {
    setStatus('offline');
    return;
  }
  if (!isSupabaseConfigured() || !supabase) {
    // Fallback to Google Drive sync if Supabase is not configured
    const { processGoogleSyncQueue } = await import('../sync/syncManager');
    return processGoogleSyncQueue();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    setStatus('auth_required', 'Cần đăng nhập lại Supabase');
    return;
  }

  syncInProgress = true;
  setStatus('syncing');

  try {
    const userId = session.user.id;
    const dbData = await exportDatabase();
    const dbJson = JSON.stringify(dbData);
    const blob = new Blob([dbJson], { type: 'application/json' });

    // Upload main vault backup to Supabase Storage 'webnote-vaults' bucket
    const filePath = `${userId}/database.json`;
    const { error } = await supabase.storage
      .from('webnote-vaults')
      .upload(filePath, blob, { upsert: true });

    if (error) throw error;

    await db.syncQueue.clear();
    lastSyncTime = nowISO();
    setStatus('saved');
  } catch (err: any) {
    console.error('[Supabase Sync] Push Error:', err);
    setStatus('error', err?.message || 'Sync failed');
  } finally {
    syncInProgress = false;
  }
}

// Pull latest Vault data from Supabase Storage to local Dexie IndexedDB
export async function syncFromSupabase(): Promise<void> {
  if (syncInProgress) return;
  if (!isSupabaseConfigured() || !supabase) {
    const { syncFromCloud: syncFromGoogle } = await import('../sync/syncManager');
    return syncFromGoogle();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    setStatus('idle');
    return;
  }

  syncInProgress = true;
  setStatus('syncing');

  try {
    const userId = session.user.id;
    const filePath = `${userId}/database.json`;

    const { data, error } = await supabase.storage
      .from('webnote-vaults')
      .download(filePath);

    if (error) {
      console.warn('[Supabase Sync] No remote backup found or download failed:', error.message);
      setStatus('saved');
      return;
    }

    const text = await data.text();
    const dbData = JSON.parse(text);

    if (dbData) {
      await loadFromDatabase({
        days: dbData.days || [],
        notebooks: dbData.notebooks || [],
        pages: dbData.pages || [],
      });

      // Refresh active Zustand Store
      const { useNotesStore } = await import('../../stores/notesStore');
      const notesStore = useNotesStore.getState();
      await notesStore.loadDays();
      await notesStore.loadRecentNotebooks();
    }

    lastSyncTime = nowISO();
    setStatus('saved');
  } catch (err: any) {
    console.error('[Supabase Sync] Pull Error:', err);
    setStatus('error', err?.message || 'Download failed');
  } finally {
    syncInProgress = false;
  }
}

export async function forceSupabaseSync(): Promise<void> {
  if (!isOnline()) {
    setStatus('offline');
    return;
  }
  await pushToSupabase();
  await syncFromSupabase();
}
