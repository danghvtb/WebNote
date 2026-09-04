// ============================================================
// MyNotes — Utility Functions
// ============================================================

/**
 * Generate a unique ID with a given prefix.
 * Uses crypto.randomUUID() for proper uniqueness.
 */
export function generateId(prefix: string): string {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${uuid}`;
}

/**
 * Generate a Day ID from a date string or Date object.
 * Format: "day_YYYYMMDD"
 */
export function dayIdFromDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `day_${yyyy}${mm}${dd}`;
}

/**
 * Get today's Day ID.
 */
export function todayId(): string {
  return dayIdFromDate(new Date());
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function todayDate(): string {
  return formatDateISO(new Date());
}

/**
 * Format a Date to YYYY-MM-DD.
 */
export function formatDateISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a date string to display format.
 * e.g., "04 Sep", "03 Sep 2025"
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  if (year === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${year}`;
}

/**
 * Format a date string to full display format.
 * e.g., "04/09/2026"
 */
export function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Get month/year label from a date string.
 * e.g., "September 2026"
 */
export function getMonthLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Check if a date is today.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === todayDate();
}

/**
 * Format time from ISO string.
 * e.g., "16:32"
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Safely parse JSON with fallback.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get the current ISO timestamp.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Simple text excerpt for search results.
 */
export function createExcerpt(text: string, maxLength: number = 120): string {
  // Strip HTML tags
  const stripped = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trim() + '…';
}

/**
 * Strip HTML tags from text for search indexing.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Get a greeting based on current hour.
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Generate a device ID for multi-device conflict detection.
 * Persists in localStorage.
 */
export function getDeviceId(): string {
  const key = 'mynotes_device_id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/**
 * Check if we're online.
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Classify the time difference for display.
 */
export function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDateDisplay(isoString.split('T')[0]);
}
