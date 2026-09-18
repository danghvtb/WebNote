// ============================================================
// MyNotes — Confirm Modal
// Generic confirmation dialog for destructive actions.
// ============================================================

import { AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { DialogShell } from '../common/DialogShell';

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
    <DialogShell open={confirmModal.open} onClose={handleCancel} ariaLabel={confirmModal.title} className="w-[calc(100%-2rem)] max-w-sm rounded-xl p-6 animate-scale-in" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
      <div
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,81,73,0.1)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
          </div>
          <div>
            <h3 id="confirm-modal-title" className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {confirmModal.title}
            </h3>
            <p id="confirm-modal-message" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {confirmModal.message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="touch-target px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            className="touch-target px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-error)', color: '#fff' }}
          >
            Xóa
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
