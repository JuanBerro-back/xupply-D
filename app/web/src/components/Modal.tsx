import { ReactNode } from 'react';
import { IconClose } from './Icons';

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  zIndex = 99999,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  zIndex?: number;
}) {
  return (
    <div className={`fixed inset-0 z-[${zIndex}] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4`} onClick={onClose}>
      <div
        className={`relative z-[${zIndex + 1}] max-h-[85vh] w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Cerrar modal"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}