export const STATUS_TRANSITIONS: Record<string, string[]> = {
  nuevo: ['confirmado', 'cancelado'],
  confirmado: ['preparando', 'cancelado'],
  preparando: ['despachado', 'cancelado'],
  despachado: ['en_camino'],
  en_camino: ['entregado'],
  entregado: [],
  cancelado: [],
};
