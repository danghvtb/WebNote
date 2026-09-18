// ============================================================
// MyNotes — Error Boundary
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAppCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg-primary)' }}>
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{ background: 'rgba(248,81,73,0.1)' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-error)' }} />
            </div>
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Đã xảy ra lỗi
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {this.state.error?.message || 'Ứng dụng gặp lỗi không mong muốn.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer touch-target"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại ứng dụng
              </button>
              <button
                onClick={() => void this.handleResetAppCache()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer touch-target"
                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              >
                Xóa cache ứng dụng
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
