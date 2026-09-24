import { query } from '../config/db';
import { emitRadarAlert } from './realtime';

/**
 * Radar de Stock: cuando el inventario de un restaurante entra en criticidad,
 * se notifica a los proveedores que el restaurante autorizó a ver su semáforo.
 *
 * Privacidad: el proveedor recibe SOLO nivel ('critical'/'low'), unidad y una
 * cantidad sugerida derivada de avg_daily_usage. Nunca current_stock ni ventas.
 */
export async function checkRadarTrigger(
  item: {
    id: number;
    restaurant_id: number;
    name: string;
    category: string | null;
    unit: string;
    avg_daily_usage: number | string;
    stock_status: string;
    supplier_id: number | null;
  },
  previousStatus: string
): Promise<void> {
  try {
    if (item.stock_status === previousStatus) return;
    if (!['critical', 'low'].includes(item.stock_status)) return;

    const shares = await query(
      `SELECT * FROM radar_shares
        WHERE restaurant_id = $1 AND is_active = TRUE
          AND (alert_on = 'critical' OR $2 = 'critical')
          AND (scope = 'todo'
               OR (scope = 'categoria' AND LOWER(category) = LOWER($3))
               OR (scope = 'producto' AND inventory_id = $4))
          AND ($5::int IS NULL OR supplier_id = $5)`,
      [item.restaurant_id, item.stock_status, item.category ?? '', item.id, item.supplier_id]
    );
    if (!shares.rowCount) return;

    // Cantidad sugerida: 3 días de consumo promedio (o mínimo 1 unidad)
    const suggested = Math.max(
      1,
      Math.ceil((Number(item.avg_daily_usage) || 1) * 3)
    );

    for (const share of shares.rows) {
      const inserted = await query(
        `INSERT INTO radar_alerts (restaurant_id, supplier_id, inventory_id, level, unit, suggested_qty)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (restaurant_id, supplier_id, inventory_id) WHERE status = 'abierta'
         DO NOTHING
         RETURNING id, suggested_qty, level, expires_at`,
        [item.restaurant_id, share.supplier_id, item.id, item.stock_status, item.unit, suggested]
      );
      if (!inserted.rowCount) continue; // ya existía una alerta abierta: sin spam
      emitRadarAlert(share.supplier_id, {
        alert_id: inserted.rows[0].id,
        restaurant: item.restaurant_id,
        item: item.name,
        level: item.stock_status,
        unit: item.unit,
        suggested_qty: Number(inserted.rows[0].suggested_qty),
        expires_at: inserted.rows[0].expires_at,
      });
    }
  } catch (err) {
    // El Radar nunca debe romper el flujo normal de inventario
    console.error('[Radar] Error en checkRadarTrigger:', err);
  }
}
