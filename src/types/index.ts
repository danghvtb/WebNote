// ============================================================
// MyNotes — Core Type Definitions
// ============================================================

// --- Data Model Types ---

export interface Day {
  id: string;        // Format: "day_YYYYMMDD"
  date: string;      // Format: "YYYY-MM-DD"
}

export interface Notebook {
  id: string;        // Format: "nb_<uuid>"
  dateId: string;    // Reference to Day.id
  title: string;
  icon: string;      // Lucide icon name
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  pageIds: string[]; // Ordered list of Page IDs
  deleted?: boolean; // Soft delete flag
}

export interface Page {
  id: string;          // Format: "page_<uuid>"
  notebookId: string;  // Reference to Notebook.id
  title: string;
  content: string;     // Tiptap JSON or HTML content
  order: number;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  deleted?: boolean;   // Soft delete flag
}

export interface Revision {
  id: string;          // Format: "rev_<uuid>"
  pageId: string;      // Reference to Page.id
  content: string;     // Snapshot of page content
  title: string;
  createdAt: string;   // ISO 8601
  deviceId: string;
}

// --- Database Types ---

export interface Database {
  version: number;
  updatedAt: string;
  days: Day[];
  notebooks: Notebook[];
  settings: AppSettings;
}

export interface AppSettings {
  theme: AppTheme;
  editorFontSize: number;
  editorLineHeight: number;
  codeTheme: string;
  lastSyncedAt?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  editorFontSize: 16,
  editorLineHeight: 1.6,
  codeTheme: 'github-dark',
};

// --- Auth Types ---

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  tokenExpiresAt: number | null;
}

// --- Sync Types ---

export type SyncStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'syncing'
  | 'error'
  | 'conflict';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'notebook' | 'page' | 'database' | 'attachment';
  entityId: string;
  data: string; // JSON stringified payload
  timestamp: string;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed';
}

// --- UI Types ---

export type AppTheme = 'dark' | 'light' | 'system';

export interface SearchResult {
  type: 'notebook' | 'page';
  id: string;
  title: string;
  excerpt: string;
  date: string;
  notebookTitle?: string;
  highlight?: string;
}

export interface SearchEntry {
  id: string;
  type: 'notebook' | 'page';
  entityId: string;
  title: string;
  content: string;
  date: string;
  notebookId?: string;
  notebookTitle?: string;
}

// --- App State Types ---

export interface AppStateRecord {
  key: string;
  value: string;
}

// --- Notification Types ---

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

// --- Google Drive Types ---

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

export interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}
