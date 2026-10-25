import { useEffect, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import {
  ConfirmPayload,
  FeedbackKind,
  ToastPayload,
  resolveConfirm,
  subscribeConfirm,
  subscribeToasts,
  toast,
} from '../lib/feedback';

const TOAST_STYLES: Record<FeedbackKind, { box: string; icon: string; Icon: typeof Info }> = {
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  error: {
    box: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    Icon: XCircle,
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-300',
    Icon: TriangleAlert,
  },
  info: {
    box: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-300',
    Icon: Info,
  },
};

export default function FeedbackHost() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);

  useEffect(() => {
    return subscribeToasts((payload) => {
      setToasts((prev) => [...prev.slice(-3), payload]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== payload.id));
      }, payload.duration);
    });
  }, []);

  useEffect(() => subscribeConfirm(setConfirm), []);

  // Mensaje que dejó una redirección (p. ej. sesión revocada).
  useEffect(() => {
    const flash = sessionStorage.getItem('xupply_flash');
    if (!flash) return;
    sessionStorage.removeItem('xupply_flash');
    toast(flash, 'warning', 8000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((item) => item.id !== id));

  return (
    <>
      {/* Región viva: accesible y sin bloquear la interacción. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+0.75rem))] z-[99999] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-4"
      >
        {toasts.map((item) => {
          const style = TOAST_STYLES[item.kind];
          const Icon = style.Icon;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border p-3 shadow-lg backdrop-blur ${style.box}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
              <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-semibold leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText}
        cancelText={confirm?.cancelText}
        isDestructive={confirm?.destructive}
        onConfirm={() => resolveConfirm(true)}
        onCancel={() => resolveConfirm(false)}
      />
    </>
  );
}
