// ============================================================
// MyNotes — Sync Loading Screen
// Full-screen overlay shown while initial cloud pull is in progress.
// Blocks all user interaction until data is fully loaded.
// ============================================================

import { Brain, CloudDownload } from 'lucide-react';

interface SyncLoadingScreenProps {
  message?: string;
}

export function SyncLoadingScreen({ message }: SyncLoadingScreenProps) {
  return (
    <div className="sync-loading-screen">
      {/* Ambient background glow */}
      <div className="sync-loading-glow" />

      <div className="sync-loading-content">
        {/* Logo */}
        <div className="sync-loading-logo">
          <Brain className="sync-loading-logo-icon" />
        </div>

        {/* Spinner ring */}
        <div className="sync-loading-spinner-container">
          <div className="sync-loading-spinner" />
          <CloudDownload className="sync-loading-cloud-icon" />
        </div>

        {/* Status text */}
        <h2 className="sync-loading-title">Đang đồng bộ dữ liệu</h2>
        <p className="sync-loading-message">
          {message || 'Đang tải dữ liệu từ Google Drive...'}
        </p>

        {/* Pulsing dots */}
        <div className="sync-loading-dots">
          <span className="sync-loading-dot" style={{ animationDelay: '0ms' }} />
          <span className="sync-loading-dot" style={{ animationDelay: '200ms' }} />
          <span className="sync-loading-dot" style={{ animationDelay: '400ms' }} />
        </div>

        <p className="sync-loading-hint">
          Vui lòng chờ, không tắt trang trong quá trình đồng bộ
        </p>
      </div>
    </div>
  );
}
