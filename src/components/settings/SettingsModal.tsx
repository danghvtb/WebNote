// ============================================================
// MyNotes — Settings Page
// Account, sync, appearance, and data management.
// ============================================================

import { useState } from 'react';
import { X, Cloud, Monitor, Moon, Sun, RefreshCw, Trash2, Bell, BellOff } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { forceSync } from '../../services/sync/syncManager';
import { clearDatabase } from '../../services/database/db';
import { signOut } from '../../services/google/auth';
import { formatTime } from '../../utils';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from '../../services/ai/geminiService';
import { areNotificationsEnabled, areSoundNotificationsEnabled, disableNotifications, enableNotificationsFromUserAction, getNotificationPermission, setSoundNotificationsEnabled } from '../../services/notification/notificationManager';
import type { AppTheme } from '../../types';
import { DialogShell } from '../common/DialogShell';

export function SettingsModal() {
  const {
    settingsOpen, setSettingsOpen, user, theme, setTheme,
    syncStatus, lastSyncTime, rootFolderId,
    logout, addNotification, setConfirmModal,
  } = useAppStore();

  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey());
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => areNotificationsEnabled());
  const [soundEnabled, setSoundEnabled] = useState(() => areSoundNotificationsEnabled());
  const [testingGeminiKey, setTestingGeminiKey] = useState(false);

  if (!settingsOpen) return null;

  const handleThemeChange = (newTheme: AppTheme) => {
    setTheme(newTheme);
  };

  const handleSync = async () => {
    try {
      await forceSync();
      addNotification('success', 'Đồng bộ hoàn tất');
    } catch {
      addNotification('error', 'Đồng bộ thất bại');
    }
  };

  const handleClearCache = () => {
    setConfirmModal({
      open: true,
      title: 'Xóa dữ liệu local?',
      message: 'Toàn bộ dữ liệu lưu trên thiết bị sẽ bị xóa. Dữ liệu trên Google Drive không bị ảnh hưởng.',
      onConfirm: async () => {
        await clearDatabase();
      addNotification('info', 'Đã xóa dữ liệu local');
      },
    });
  };

  const handleDisconnect = () => {
    setConfirmModal({
      open: true,
      title: 'Đăng xuất tài khoản Google?',
      message: 'Ứng dụng sẽ đăng xuất và xóa dữ liệu local. Ghi chú trên Google Drive vẫn được giữ an toàn.',
      onConfirm: () => {
        signOut();
        logout();
        setSettingsOpen(false);
      },
    });
  };

  const handleEnableNotifications = async () => {
    const granted = await enableNotificationsFromUserAction();
    setNotificationPermission(getNotificationPermission());
    setNotificationsEnabled(granted);
    addNotification(granted ? 'success' : 'warning', granted ? 'Đã bật nhắc deadline trên trình duyệt.' : 'Trình duyệt chưa cấp quyền thông báo.');
  };

  const handleDisableNotifications = () => {
    disableNotifications();
    setNotificationsEnabled(false);
    addNotification('info', 'Đã tắt nhắc deadline trên trình duyệt.');
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundNotificationsEnabled(next);
    setSoundEnabled(next);
  };

  const handleTestGeminiKey = async () => {
    setTestingGeminiKey(true);
    try {
      const result = await testGeminiApiKey(geminiKey);
      addNotification(result.ok ? 'success' : 'error', result.message);
    } finally {
      setTestingGeminiKey(false);
    }
  };

  const themes: { value: AppTheme; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Tối', icon: <Moon className="w-4 h-4" /> },
    { value: 'light', label: 'Sáng', icon: <Sun className="w-4 h-4" /> },
    { value: 'system', label: 'Theo hệ thống', icon: <Monitor className="w-4 h-4" /> },
  ];
  const syncStatusLabel: Record<string, string> = { saved: 'Đã lưu', syncing: 'Đang đồng bộ', offline: 'Ngoại tuyến', error: 'Lỗi', auth_required: 'Cần kết nối', idle: 'Chưa đồng bộ' };

  return (
    <DialogShell open={settingsOpen} onClose={() => setSettingsOpen(false)} ariaLabel="Cài đặt" className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden animate-scale-in flex flex-col" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
      <div
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cài đặt</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded-lg cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Đóng cài đặt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Account Section */}
          <Section title="Tài khoản">
            <div className="flex items-center gap-3">
              {user?.picture && (
                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user?.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{user?.email}</p>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(63,185,80,0.1)', color: 'var(--color-success)' }}>
                Đã kết nối
              </span>
            </div>
          </Section>

          {/* Storage Section */}
          <Section title="Lưu trữ">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Google Drive</span>
            </div>
            <p className="text-xs ml-6" style={{ color: 'var(--color-text-tertiary)' }}>
              Thư mục: MyNotes
            </p>
            {rootFolderId && (
              <p className="text-xs ml-6 mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                ID: {rootFolderId.slice(0, 20)}...
              </p>
            )}
          </Section>

          {/* Sync Section */}
          <Section title="Đồng bộ">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Trạng thái: <span style={{ color: syncStatus === 'saved' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{syncStatusLabel[syncStatus] || syncStatus}</span>
                </p>
                {lastSyncTime && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    Đồng bộ gần nhất: {formatTime(lastSyncTime)}
                  </p>
                )}
              </div>
              <button
                onClick={handleSync}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              >
                <RefreshCw className="w-3 h-3" />
                Đồng bộ ngay
              </button>
            </div>
          </Section>

          {/* Notification preferences: permission is requested only from this user action. */}
          <Section title="Thông báo deadline">
            <div className="flex items-start gap-3">
              {notificationsEnabled ? <Bell className="w-4 h-4 mt-0.5 text-emerald-400" /> : <BellOff className="w-4 h-4 mt-0.5 text-slate-500" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Nhắc công việc sắp đến hạn</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  Quyền hiện tại: {notificationPermission === 'unsupported' ? 'Không hỗ trợ' : notificationPermission === 'granted' ? 'Đã cấp' : notificationPermission === 'denied' ? 'Đã từ chối' : 'Chưa hỏi'}
                </p>
              </div>
              {notificationsEnabled ? (
                <button onClick={handleDisableNotifications} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>Tắt</button>
              ) : (
                <button onClick={handleEnableNotifications} disabled={notificationPermission === 'denied' || notificationPermission === 'unsupported'} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>Bật</button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-3">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Âm thanh cảnh báo</span>
              <button onClick={handleToggleSound} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: soundEnabled ? 'var(--color-accent-dim)' : 'var(--color-bg-tertiary)', color: soundEnabled ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
                {soundEnabled ? 'Đang bật' : 'Đang tắt'}
              </button>
            </div>
          </Section>

          {/* Appearance Section */}
          <Section title="Giao diện">
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

          {/* Gemini AI Config Section */}
          <Section title="Trợ lý Google Gemini AI">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-purple-300 flex items-center justify-between">
                <span>Gemini API Key (Miễn phí từ Google AI Studio)</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline text-[10px]"
                >
                  Lấy Key Miễn Phí ↗
                </a>
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setGeminiApiKey(e.target.value);
                }}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-purple-500/40 text-slate-200 outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={handleTestGeminiKey}
                disabled={!geminiKey.trim() || testingGeminiKey}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
              >
                {testingGeminiKey ? 'Đang kiểm tra…' : 'Kiểm tra API key'}
              </button>
              <p className="text-[10px] text-slate-400">
                Key chỉ được lưu trong trình duyệt (LocalStorage). AI chỉ gửi phạm vi bạn chọn trong cửa sổ AI; khi không có key, ứng dụng dùng bộ phân tích cục bộ.
              </p>
            </div>
          </Section>

          {/* Danger Zone */}
          <Section title="Khu vực nguy hiểm" danger>
            <div className="space-y-2">
              <button
                onClick={handleClearCache}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-left"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 className="w-4 h-4" />
                Xóa dữ liệu local
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-left"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 className="w-4 h-4" />
                Đăng xuất tài khoản Google
              </button>
            </div>
          </Section>
        </div>
      </div>
    </DialogShell>
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
