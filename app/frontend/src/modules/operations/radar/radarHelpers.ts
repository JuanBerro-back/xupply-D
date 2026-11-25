export const money = (n: string | number) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const LEVEL_BADGE: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'CRÍTICO', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  low: { label: 'BAJO', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

export const OFFER_BADGE: Record<string, string> = {
  pendiente: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-rose-100 text-rose-700',
  expirada: 'bg-slate-100 text-slate-500',
};

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'vencida';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d restantes`;
  if (h > 0) return `${h}h restantes`;
  return `${Math.max(1, Math.floor(ms / 60000))} min restantes`;
}
