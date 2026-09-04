// ============================================================
// MyNotes — Header Component
// Top bar: logo, search, sync status, user avatar.
// ============================================================

import { Search, Cloud, CloudOff, Loader2, AlertTriangle, Check, Menu } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { formatTime } from '../../utils';
import { forceSync } from '../../services/sync/syncManager';
import { signOut } from '../../services/google/auth';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const {
    user, syncStatus, lastSyncTime, syncMessage,
    toggleSearch, setSettingsOpen, logout,
  } = useAppStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const handleLogout = () => {
    signOut();
    logout();
    setUserMenuOpen(false);
  };

  const handleSync = () => {
    forceSync();
  };

  const renderSyncStatus = () => {
    const statusConfig: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
      idle: { icon: <Cloud className="w-3.5 h-3.5" />, text: 'Ready', color: 'var(--color-text-tertiary)' },
      saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Saving...', color: 'var(--color-text-secondary)' },
      saved: { icon: <Check className="w-3.5 h-3.5" />, text: lastSyncTime ? `Saved ${formatTime(lastSyncTime)}` : 'Saved', color: 'var(--color-success)' },
      offline: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Offline', color: 'var(--color-warning)' },
      syncing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Syncing...', color: 'var(--color-accent)' },
      error: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Sync Error', color: 'var(--color-error)' },
      conflict: { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Conflict', color: 'var(--color-warning)' },
    };

    const config = statusConfig[syncStatus] || statusConfig.idle;
    return (
      <button
        onClick={handleSync}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        style={{ color: config.color }}
        title={syncMessage || `Status: ${syncStatus}`}
        aria-label={`Sync status: ${config.text}`}
      >
        {config.icon}
        <span className="hidden sm:inline">{config.text}</span>
      </button>
    );
  };

  return (
    <header
      className="flex items-center justify-between px-4 h-12 flex-shrink-0"
      style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Left: Logo + Mobile Menu */}
      <div className="flex items-center gap-2">
        <button
          className="lg:hidden p-1.5 rounded-lg cursor-pointer"
          style={{ color: 'var(--color-text-secondary)' }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--color-accent-dim)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--color-accent)' }}>M</span>
          </div>
          <span className="font-semibold text-sm hidden sm:inline" style={{ color: 'var(--color-text-primary)' }}>MyNotes</span>
        </div>
      </div>

      {/* Center: Search */}
      <button
        onClick={toggleSearch}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer max-w-xs w-full sm:w-64"
        style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}
        aria-label="Search notes"
      >
        <Search className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Search notes...</span>
        <kbd
          className="ml-auto text-xs px-1.5 py-0.5 rounded hidden sm:inline"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right: Sync + Avatar */}
      <div className="flex items-center gap-1">
        {renderSyncStatus()}

        {/* User Avatar */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-7 h-7 rounded-full overflow-hidden cursor-pointer focus:outline-none"
            style={{ border: '2px solid var(--color-border)' }}
            aria-label="User menu"
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
                Settings
              </button>
              <button
                onClick={handleSync}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Sync Now
              </button>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
