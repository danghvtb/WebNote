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
  | 'conflict'
  | 'auth_required';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'notebook' | 'page' | 'database' | 'attachment' | 'schedule';
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

// --- Custom User Task & Work Category Types ---

export interface WorkCategory {
  id: string;               // Format: "cat_<uuid>"
  name: string;             // e.g. "Dự án WebNote", "Học tập", "Cá nhân"
  color: string;            // Hex color code
  icon?: string;            // Lucide icon name
  createdAt: string;
}

export interface CustomUserTask {
  id: string;               // Format: "utask_<uuid>"
  title: string;
  description?: string;
  categoryId?: string;      // Reference to WorkCategory.id
  categoryName?: string;
  status: 'todo' | 'in_progress' | 'completed';
  dueDate?: string;         // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

// --- Schedule & Time Blocking Types ---

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'weekdays';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;        // e.g. every 1 week, every 2 days
  endDate?: string;         // YYYY-MM-DD
  daysOfWeek?: number[];    // 0 = Sun, 1 = Mon ... 6 = Sat
}

export interface ScheduleBlock {
  id: string;               // Format: "sched_<uuid>"
  taskId?: string;          // Direct link to ParsedTask ID (if linked to a note task)
  customTaskId?: string;    // Direct link to CustomUserTask ID
  categoryId?: string;      // Direct link to WorkCategory ID
  pageId?: string;          // Reference to Page.id
  notebookId?: string;      // Reference to Notebook.id
  title: string;
  description?: string;
  date: string;             // Format: "YYYY-MM-DD"
  startTime?: string;       // Format: "HH:mm" (24h e.g., "14:30")
  endTime?: string;         // Format: "HH:mm" (24h e.g., "15:30")
  estimatedMinutes?: number;// Estimated duration in minutes
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  color?: string;           // Hex or Tailwind color string
  recurrence?: RecurrenceRule;
  aiSuggested?: boolean;    // Flagged true if generated by Gemini AI Optimizer
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}

export interface DaySchedule {
  date: string;
  blocks: ScheduleBlock[];
  totalEstimatedMinutes: number;
  aiSummary?: string;
}


