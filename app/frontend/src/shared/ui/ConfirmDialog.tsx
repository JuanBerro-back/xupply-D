import Modal from './Modal';
import { ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-sm">
      <div className="text-sm text-slate-600 dark:text-slate-300 mb-6">
        {message}
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
          }}
          className={`rounded-xl px-4 py-2 font-bold text-white transition ${
            isDestructive
              ? 'bg-rose-500 hover:bg-rose-600'
              : 'bg-brand hover:bg-brand-dark'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
