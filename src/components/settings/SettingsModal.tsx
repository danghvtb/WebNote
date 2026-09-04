// ============================================================
// MyNotes — Settings Page
// Account, sync, appearance, and data management.
// ============================================================

import { X, Cloud, Monitor, Moon, Sun, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { forceSync } from '../../services/sync/syncManager';
import { clearDatabase } from '../../services/database/db';
import { signOut } from '../../services/google/auth';
import { formatTime } from '../../utils';
import type { AppTheme } from '../../types';

export function SettingsModal() {
  const {
    settingsOpen, setSettingsOpen, user, theme, setTheme,
    syncStatus, lastSyncTime, rootFolderId,
    logout, addNotification, setConfirmModal,
  } = useAppStore();

  if (!settingsOpen) return null;

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme);
  };

  const handleSync = async () => {
    try {
      await forceSync();
      addNotification('success', 'Sync complete');
    } catch {
      addNotification('error', 'Sync failed');
    }
  };

  const handleClearCache = () => {
    setConfirmModal({
      open: true,
      title: 'Clear Local Cache',
      message: 'This will clear all locally cached data. Your data on Google Drive will not be affected.',
      onConfirm: async () => {
        await clearDatabase();
        addNotification('info', 'Local cache cleared');
      },
    });
  };

  const handleDisconnect = () => {
    setConfirmModal({
      open: true,
      title: 'Disconnect Google Account',
      message: 'This will sign you out and clear local data. Your notes on Google Drive will remain safe.',
      onConfirm: () => {
        signOut();
        logout();
        setSettingsOpen(false);
      },
    });
  };

  const themes: { value: AppTheme; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden animate-scale-in flex flex-col"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded-lg cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Account Section */}
          <Section title="Account">
            <div className="flex items-center gap-3">
              {user?.picture && (
                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user?.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{user?.email}</p>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(63,185,80,0.1)', color: 'var(--color-success)' }}>
                Connected
              </span>
            </div>
          </Section>

          {/* Storage Section */}
          <Section title="Storage">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Google Drive</span>
            </div>
            <p className="text-xs ml-6" style={{ color: 'var(--color-text-tertiary)' }}>
              Folder: MyNotes
            </p>
            {rootFolderId && (
              <p className="text-xs ml-6 mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                ID: {rootFolderId.slice(0, 20)}...
              </p>
            )}
          </Section>

          {/* Sync Section */}
          <Section title="Sync">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Status: <span style={{ color: syncStatus === 'saved' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{syncStatus}</span>
                </p>
                {lastSyncTime && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    Last sync: {formatTime(lastSyncTime)}
                  </p>
                )}
              </div>
              <button
                onClick={handleSync}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              >
                <RefreshCw className="w-3 h-3" />
                Sync Now
              </button>
            </div>
          </Section>

          {/* Appearance Section */}
          <Section title="Appearance">
            <div className="flex gap-2">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleThemeChange(t.value)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    background: theme === t.value ? 'var(--color-accent-dim)' : 'var(--color-bg-tertiary)',
                    color: theme === t.value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    border: theme === t.value ? '1px solid var(--color-accent)' : '1px solid transparent',
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Danger Zone */}
          <Section title="Danger Zone" danger>
            <div className="space-y-2">
              <button
                onClick={handleClearCache}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-left"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 className="w-4 h-4" />
                Clear Local Cache
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-left"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 className="w-4 h-4" />
                Disconnect Google Account
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="mb-6">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}
      >
        {title}
      </h3>
      <div
        className="p-3 rounded-lg"
        style={{ background: 'var(--color-bg-primary)', border: danger ? '1px solid rgba(248,81,73,0.2)' : '1px solid var(--color-border)' }}
      >
        {children}
      </div>
    </div>
  );
}
