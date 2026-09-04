// ============================================================
// MyNotes — Confirm Modal
// Generic confirmation dialog for destructive actions.
// ============================================================

import { AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function ConfirmModal() {
  const { confirmModal, setConfirmModal } = useAppStore();

  if (!confirmModal.open) return null;

  const handleConfirm = () => {
    confirmModal.onConfirm?.();
    setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
  };

  const handleCancel = () => {
    setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 animate-scale-in"
        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,81,73,0.1)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {confirmModal.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {confirmModal.message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-error)', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
