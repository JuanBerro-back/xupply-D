import { query } from '../../../shared/config/db';

export function getSummary(restaurantId: number) {
  return query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0) AS egresos
     FROM accounting_transactions WHERE restaurant_id = $1`,
    [restaurantId]
  );
}
