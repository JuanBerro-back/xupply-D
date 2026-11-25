/**
 * Feedback global de la interfaz.
 *
 * Reemplaza `alert()` y `window.confirm()` por notificaciones no bloqueantes y
 * un diálogo accesible. Se usa desde cualquier página sin acoplarse a un
 * contexto de React (útil en handlers async y utilidades).
 */

export type FeedbackKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  id: number;
  message: string;
  kind: FeedbackKind;
  duration: number;
}

export interface ConfirmPayload {
  id: number;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
}

type ToastListener = (payload: ToastPayload) => void;
type ConfirmListener = (payload: ConfirmPayload | null) => void;

const toastListeners = new Set<ToastListener>();
const confirmListeners = new Set<ConfirmListener>();

let sequence = 1;
let pendingConfirm: { payload: ConfirmPayload; resolve: (value: boolean) => void } | null = null;

export function subscribeToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function subscribeConfirm(listener: ConfirmListener): () => void {
  confirmListeners.add(listener);
  return () => confirmListeners.delete(listener);
}

export function toast(message: string, kind: FeedbackKind = 'info', duration = 5000): void {
  const text = String(message ?? '').trim();
  if (!text) return;
  const payload: ToastPayload = { id: sequence++, message: text, kind, duration };
  for (const listener of toastListeners) listener(payload);
}

/** Mensaje legible a partir de un error desconocido. */
export function errorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

/**
 * Diálogo de confirmación con promesa. Uso:
 *   if (!(await confirmAction({ message: '¿Eliminar?' }))) return;
 */
export function confirmAction(options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (pendingConfirm) {
    // Solo puede haber un diálogo a la vez; el anterior se cancela.
    pendingConfirm.resolve(false);
    pendingConfirm = null;
  }
  const payload: ConfirmPayload = {
    id: sequence++,
    title: options.title ?? 'Confirmar acción',
    message: options.message,
    confirmText: options.confirmText ?? 'Confirmar',
    cancelText: options.cancelText ?? 'Cancelar',
    destructive: options.destructive ?? false,
  };
  return new Promise<boolean>((resolve) => {
    pendingConfirm = { payload, resolve };
    for (const listener of confirmListeners) listener(payload);
  });
}

/** Llamado por el host visual cuando el usuario decide. */
export function resolveConfirm(accepted: boolean): void {
  if (!pendingConfirm) return;
  const { resolve } = pendingConfirm;
  pendingConfirm = null;
  for (const listener of confirmListeners) listener(null);
  resolve(accepted);
}
