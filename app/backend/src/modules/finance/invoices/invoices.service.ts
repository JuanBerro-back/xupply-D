export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['emitida', 'anulada'],
  emitida: ['pagada', 'anulada'],
  pagada: ['anulada'],
  anulada: [],
};
