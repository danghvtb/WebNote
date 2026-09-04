// ============================================================
// MyNotes — Toast Notifications
// ============================================================

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

export function Toasts() {
  const { notifications, removeNotification } = useAppStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notif) => {
        const Icon = iconMap[notif.type];
        const color = colorMap[notif.type];

        return (
          <div
            key={notif.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-up"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
            <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
              {notif.message}
            </span>
            <button
              onClick={() => removeNotification(notif.id)}
              className="p-0.5 rounded cursor-pointer"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
