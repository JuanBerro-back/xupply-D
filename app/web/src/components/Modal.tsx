import { ReactNode, useEffect } from 'react';
import { IconClose } from './Icons';

// Pila de modales abiertos: Escape solo cierra el último (el visible encima).
const modalStack: Array<() => void> = [];
let scrollLocks = 0;
let previousOverflow = '';

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
  useEffect(() => {
    if (scrollLocks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    modalStack.push(onClose);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== onClose) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      const index = modalStack.lastIndexOf(onClose);
      if (index >= 0) modalStack.splice(index, 1);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative max-h-[88vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
        style={{ zIndex: zIndex + 1 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Cerrar modal"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
