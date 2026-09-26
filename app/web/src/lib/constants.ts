export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'bg-yellow-100 text-yellow-700' },
  preparando: { label: 'En preparación', color: 'bg-orange-100 text-orange-700' },
  despachado: { label: 'Despachado', color: 'bg-purple-100 text-purple-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export const DELIVERY_STATUS: Record<string, { label: string; color: string }> = {
  asignado: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  llegando: { label: 'Llegando', color: 'bg-orange-100 text-orange-700' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  fallido: { label: 'Fallido', color: 'bg-red-100 text-red-700' },
};

export const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  emitida: { label: 'Emitida', color: 'bg-blue-100 text-blue-700' },
  pagada: { label: 'Pagada', color: 'bg-green-100 text-green-700' },
  anulada: { label: 'Anulada', color: 'bg-red-100 text-red-700' },
};

export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['emitida', 'anulada'],
  emitida: ['pagada', 'anulada'],
  pagada: ['anulada'],
  anulada: [],
};

export const SUPPLIER_FLOW = ['confirmado', 'preparando', 'despachado', 'en_camino', 'entregado'];

export function formatMoney(n: number | string) {
  return `$${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO');
}