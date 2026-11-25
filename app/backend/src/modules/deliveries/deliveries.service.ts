import { timingSafeEqual } from 'crypto';
import { query } from '../../shared/config/db';
import { DeliveryUser, DeliveryRow } from './deliveries.types';

type DriverQueryResult = { rowCount?: number | null; rows: Array<Record<string, any>> };
type DriverQuery = (sql: string, params?: unknown[]) => Promise<DriverQueryResult>;

export type DriverCheckReason = 'missing' | 'wrong_role' | 'foreign_supplier';

/**
 * Resuelve un domiciliario activo y comprueba que pertenezca al proveedor
 * esperado. Devuelve el motivo del fallo para que cada handler responda con su
 * mensaje y su rollback; la consulta puede ejecutarse dentro de una transacción.
 */
export async function resolveActiveDriverForSupplier(
  driverId: unknown,
  expectedSupplierId: number | null,
  executor: DriverQuery = query
): Promise<{ driver?: Record<string, any>; reason?: DriverCheckReason }> {
  const result = await executor(
    `SELECT u.id, u.name, u.supplier_id, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND u.is_active = TRUE`,
    [Number(driverId)]
  );
  const driver = result.rows[0];
  if (!driver) return { reason: 'missing' };
  if (driver.role_name !== 'domiciliario') return { reason: 'wrong_role' };
  if (Number(driver.supplier_id) !== Number(expectedSupplierId)) return { reason: 'foreign_supplier' };
  return { driver };
}

/**
 * El código de confirmación es una llave de doble control: lo lleva el
 * domiciliario y lo valida el restaurante al recibir. Por eso NO debe
 * devolverse a los usuarios del restaurante (podrían auto-confirmar sin que
 * el conductor esté presente), ni a proveedores de otro inquilino.
 */
export function canSeeConfirmationCode(user: DeliveryUser, row: DeliveryRow): boolean {
  if (user.role === 'admin') return true;
  if (
    user.role === 'proveedor_admin' &&
    user.supplier_id &&
    Number(row.order_supplier_id) === Number(user.supplier_id)
  ) {
    return true;
  }
  if (user.role === 'domiciliario' && Number(row.driver_id) === Number(user.id)) {
    return true;
  }
  return false;
}

/** Quita el código de confirmación de la respuesta para quien no debe verlo. */
export function redactDelivery<T extends DeliveryRow>(row: T, user: DeliveryUser): T {
  if (!row || canSeeConfirmationCode(user, row)) return row;
  const { confirmation_code, ...rest } = row;
  return { ...rest, has_security_code: Boolean(confirmation_code) } as unknown as T;
}

// Límite de intentos de la llave de entrega (anti fuerza bruta de 4 dígitos).
// Se cuenta por usuario + entrega para no bloquear a otros usuarios legítimos.
export const confirmAttempts = new Map<string, { count: number; resetAt: number }>();
export const CONFIRM_MAX_ATTEMPTS = 5;
export const CONFIRM_WINDOW_MS = 10 * 60 * 1000;

export function confirmKey(userId: number, deliveryId: number): string {
  return `${userId}:${deliveryId}`;
}

export function checkConfirmRateLimit(userId: number, deliveryId: number): boolean {
  const now = Date.now();
  const key = confirmKey(userId, deliveryId);
  const entry = confirmAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    confirmAttempts.set(key, { count: 0, resetAt: now + CONFIRM_WINDOW_MS });
    return true;
  }
  return entry.count < CONFIRM_MAX_ATTEMPTS;
}

export function registerConfirmFailure(userId: number, deliveryId: number): void {
  const key = confirmKey(userId, deliveryId);
  const entry = confirmAttempts.get(key);
  if (entry) entry.count += 1;
  else confirmAttempts.set(key, { count: 1, resetAt: Date.now() + CONFIRM_WINDOW_MS });
  if (confirmAttempts.size > 5000) {
    const now = Date.now();
    for (const [mapKey, value] of confirmAttempts) {
      if (value.resetAt <= now) confirmAttempts.delete(mapKey);
    }
  }
}

export function codesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(String(expected).trim());
  const b = Buffer.from(String(received).trim());
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// Últimos pings por entrega, para el throttle del servidor (5 s mín.)
export const positionThrottle = new Map<number, number>();
export const MIN_PING_MS = 5000;
export const MIN_MOVE_M = 10; // no guardar en route_history si se movió menos de 10 m
