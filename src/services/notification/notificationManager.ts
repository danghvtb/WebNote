// ============================================================
// MyNotes — Web Audio API & Native Browser Push Notification Manager
// Plays soft notification chimes and pushes native OS notifications.
// ============================================================

const NOTIFICATION_PREFERENCE_KEY = 'mynotes_notifications_enabled';
const SOUND_PREFERENCE_KEY = 'mynotes_notification_sound_enabled';

function hasNotificationApi(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Current browser permission without prompting the user. */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  return hasNotificationApi() ? Notification.permission : 'unsupported';
}

/** Whether the user explicitly enabled deadline notifications in WebNote. */
export function areNotificationsEnabled(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(NOTIFICATION_PREFERENCE_KEY) === '1';
}

/** Sound remains enabled by default for existing users; it is independently configurable. */
export function areSoundNotificationsEnabled(): boolean {
  return typeof localStorage === 'undefined' || localStorage.getItem(SOUND_PREFERENCE_KEY) !== '0';
}

export function setSoundNotificationsEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? '1' : '0');
}

/**
 * Play a soft synth chime using Web Audio API (no external file dependencies)
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    // Play two-tone pleasant chime (E5 -> A5)
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.warn('[NotificationSound] Audio play error:', err);
  }
}

/**
 * Request Browser Push Notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!hasNotificationApi()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, granted ? '1' : '0');
    }
    return granted;
  }
  return false;
}

/** Must be called from a user gesture (for example the Settings button). */
export async function enableNotificationsFromUserAction(): Promise<boolean> {
  return requestNotificationPermission();
}

export function disableNotifications(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, '0');
}

/**
 * Send Native OS Push Notification
 */
export function sendNativeNotification(title: string, options?: NotificationOptions): void {
  if (!hasNotificationApi() || !areNotificationsEnabled()) return;
  
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: './favicon.svg',
        badge: './favicon.svg',
        ...options,
      });
    } catch (err) {
      console.warn('[NativeNotification] Send error:', err);
    }
  }
}
