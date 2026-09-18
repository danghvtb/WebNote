// ============================================================
// MyNotes — Header Component
// Top bar: logo, search, sync status, user avatar.
// ============================================================

import { Search, Cloud, CloudOff, Loader2, AlertTriangle, Check, Menu, Network, CheckSquare, Download, Calendar, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { formatTime } from '../../utils';
import { forceSync } from '../../services/sync/syncManager';
import { signOut } from '../../services/google/auth';
import { useState, useRef, useEffect } from 'react';
import { vi } from '../../i18n/vi';

export function Header() {
  const {
    user, syncStatus, lastSyncTime, syncMessage,
    toggleSearch, setSettingsOpen, logout, setGraphViewOpen,
    setTaskManagerOpen, setExportModalOpen, setTrashModalOpen, setTagManagerOpen, setProjectManagerOpen,
    mobileSidebarOpen, setMobileSidebarOpen, setMobileDaySidebarOpen,
  } = useAppStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [userMenuOpen]);

  const handleLogout = () => {
    signOut();
    logout();
    setUserMenuOpen(false);
  };

  // Switching accounts deliberately clears the active session; the next
  // sign-in uses GIS's account picker (prompt=select_account).
  const handleSwitchAccount = () => {
    handleLogout();
  };

  const handleSync = async () => {
    try {
      if (syncStatus === 'auth_required' || syncStatus === 'error') {
        const { initGoogleAuth, connectGoogleDrive, fetchUserProfile } = await import('../../services/google/auth');
        await initGoogleAuth();
        const token = await connectGoogleDrive(user?.email);
        const profile = await fetchUserProfile(token);
        if (user?.email && profile.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new Error('Tài khoản Google không khớp. Hãy đăng xuất rồi chọn Đổi tài khoản.');
        }
        const { setAuth } = useAppStore.getState();
        setAuth(profile, token);
      }
      await forceSync();
    } catch (err) {
      console.warn('[Header] Re-auth failed:', err);
    }
  };

  const renderSyncStatus = () => {
    if (syncStatus === 'auth_required') {
      return (
        <button
          onClick={handleSync}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer animate-pulse"
          title="Phiên đăng nhập đã hết hạn. Bấm để kết nối lại Google Drive"
          aria-label="Cần kết nối lại Google Drive"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Kết nối lại Drive</span>
        </button>
      );
    }

    const statusConfig: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
      idle: { icon: <Cloud className="w-3.5 h-3.5" />, text: 'Sẵn sàng', color: 'var(--color-text-tertiary)' },
      saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Đang lưu…', color: 'var(--color-text-secondary)' },
      saved: { icon: <Check className="w-3.5 h-3.5" />, text: lastSyncTime ? `Đã lưu ${formatTime(lastSyncTime)}` : 'Đã lưu', color: 'var(--color-success)' },
      offline: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Ngoại tuyến', color: 'var(--color-warning)' },
      syncing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Đang đồng bộ…', color: 'var(--color-accent)' },
      error: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Lỗi đồng bộ', color: 'var(--color-error)' },
      conflict: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Xung đột', color: 'var(--color-warning)' },
    };

    const config = statusConfig[syncStatus] || statusConfig.idle;
    return (
      <button
        onClick={handleSync}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        style={{ color: config.color }}
        title={syncMessage || `Trạng thái: ${syncStatus}`}
        aria-label={`Trạng thái đồng bộ: ${config.text}`}
      >
        {config.icon}
        <span className="hidden md:inline">{config.text}</span>
      </button>
    );
  };

  return (
    <header
      className="flex items-center justify-between px-3 md:px-4 h-13 flex-shrink-0 glass-header gap-2"
    >
      {/* Left: Logo + Mobile Menu Toggle */}
      <div className="flex items-center gap-2">
        <button
          className="md:hidden p-1.5 rounded-lg cursor-pointer hover:bg-slate-800 text-slate-300 transition-colors"
          onClick={() => {
            const nextOpen = !mobileSidebarOpen;
            setMobileSidebarOpen(nextOpen);
            if (nextOpen) setMobileDaySidebarOpen(true);
          }}
          aria-label={mobileSidebarOpen ? 'Đóng bảng điều hướng' : 'Mở bảng điều hướng'}
          aria-expanded={mobileSidebarOpen}
          title="Sổ ghi chú và trang"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-accent-dim)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--color-accent)' }}>M</span>
          </div>
          <span className="font-semibold text-sm hidden sm:inline" style={{ color: 'var(--color-text-primary)' }}>{vi.appName}</span>
        </div>
      </div>

      {/* Center: Search */}
      <button
        onClick={toggleSearch}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 max-w-[180px] sm:max-w-xs"
        style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}
        aria-label="Tìm kiếm ghi chú"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{vi.search}</span>
        <kbd
          className="ml-auto text-xs px-1.5 py-0.5 rounded hidden sm:inline"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right: Sync + Actions + Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <button
          onClick={() => setGraphViewOpen(true)}
          className="hidden md:flex touch-target p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer items-center gap-1.5 text-sm font-semibold border border-transparent hover:border-cyan-500/30"
          title="Mở sơ đồ liên kết"
          aria-label="Mở sơ đồ liên kết"
        >
          <Network className="w-5 h-5 text-cyan-400" />
          <span className="hidden lg:inline">Đồ thị</span>
        </button>

        <button
          onClick={() => setTaskManagerOpen(true)}
          className="hidden md:flex touch-target p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer items-center gap-1.5 text-sm font-semibold border border-transparent hover:border-purple-500/30"
          title="Mở trung tâm công việc"
          aria-label="Mở trung tâm công việc"
        >
          <CheckSquare className="w-5 h-5 text-purple-400" />
          <span className="hidden lg:inline">Công việc</span>
        </button>

        <button
          onClick={() => {
            const { activeTab, setActiveTab } = useScheduleStore.getState();
            setActiveTab(activeTab === 'schedule' ? 'notes' : 'schedule');
          }}
          className="hidden md:flex touch-target p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer items-center gap-1.5 text-sm font-semibold border border-transparent hover:border-amber-500/30"
          title="Mở lịch biểu"
          aria-label="Mở lịch biểu"
        >
          <Calendar className="w-5 h-5 text-amber-400" />
          <span className="hidden lg:inline">Lịch Biểu</span>
        </button>

        <button
          onClick={() => setExportModalOpen(true)}
          className="hidden md:flex touch-target p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer items-center gap-1.5 text-sm font-semibold border border-transparent hover:border-emerald-500/30"
          title="Xuất hoặc sao lưu dữ liệu"
          aria-label="Xuất hoặc sao lưu dữ liệu"
        >
          <Download className="w-5 h-5 text-emerald-400" />
          <span className="hidden lg:inline">Xuất dữ liệu</span>
        </button>

        <button
          onClick={() => setTrashModalOpen(true)}
          className="hidden md:flex touch-target p-2 rounded-xl text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 transition-all cursor-pointer items-center gap-1.5 text-sm font-semibold border border-transparent hover:border-rose-500/30"
          title="Thùng rác (Trash Bin)"
        >
          <Trash2 className="w-5 h-5 text-rose-400" />
          <span className="hidden lg:inline">{vi.trash}</span>
        </button>
        {renderSyncStatus()}

        {/* User Avatar */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="touch-target w-10 h-10 rounded-full overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ring-2 ring-purple-500/40 hover:ring-purple-400 transition-all"
            style={{ border: '2px solid var(--color-border)' }}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                {user?.name?.charAt(0) || '?'}
              </div>
            )}
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div
              className="absolute right-0 top-9 w-56 rounded-xl py-1 animate-scale-in z-50"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
              role="menu"
              aria-label="Menu tài khoản"
            >
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user?.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{user?.email}</p>
              </div>
              <button
                onClick={() => { setSettingsOpen(true); setUserMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Cài đặt
              </button>
              <button
                onClick={() => { setTagManagerOpen(true); setUserMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Quản lý thẻ
              </button>
              <button
                onClick={() => { setProjectManagerOpen(true); setUserMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Quản lý dự án
              </button>
              <div className="md:hidden" style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
              <div className="md:hidden" aria-label="Công cụ">
                <button
                  onClick={() => { setGraphViewOpen(true); setUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  role="menuitem"
                >Sơ đồ liên kết</button>
                <button
                  onClick={() => { setTaskManagerOpen(true); setUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  role="menuitem"
                >Trung tâm công việc</button>
                <button
                  onClick={() => { const { setActiveTab } = useScheduleStore.getState(); setActiveTab('schedule'); setUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  role="menuitem"
                >Lịch biểu</button>
                <button
                  onClick={() => { setExportModalOpen(true); setUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  role="menuitem"
                >Xuất / sao lưu</button>
                <button
                  onClick={() => { setTrashModalOpen(true); setUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                  role="menuitem"
                >{vi.trash}</button>
              </div>
              <button
                onClick={handleSync}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Đồng bộ ngay
              </button>
              <button
                onClick={handleSwitchAccount}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Đổi tài khoản Google
              </button>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
