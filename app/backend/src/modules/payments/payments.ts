import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool, query } from '../../shared/config/db';
import { emitOrder } from '../../shared/lib/realtime';
import { findTransactionByReference, toCents, WompiTransaction } from './wompi';

export type PlanTier = 'basico' | 'medio' | 'premium';
export type IntentKind = 'pedido' | 'suscripcion';

/** Precios de lista en COP. Deben coincidir con app/frontend/src/modules/finance/plans/utils/planAccess.ts. */
export const PLAN_PRICES_COP: Record<PlanTier, number> = {
  basico: 0,
  medio: 250000,
  premium: 500000,
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  basico: 'Plan Básico',
  medio: 'Plan Medio',
  premium: 'Plan Premium',
};

export function isPlanTier(value: unknown): value is PlanTier {
  return value === 'basico' || value === 'medio' || value === 'premium';
}

export function newReference(kind: IntentKind): string {
  const prefix = kind === 'pedido' ? 'ORD' : 'SUB';
  return `XUP-${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Periodo mensual de suscripción a partir de una fecha. */
export function billingPeriod(from = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: isoDate(start), end: isoDate(end) };
}

export interface PaymentIntentRow {
  id: string;
  kind: IntentKind;
  restaurant_id: number | null;
  supplier_id: number | null;
  order_id: number | null;
  subscription_id: number | null;
  amount_cop: string | number;
  currency: string;
  provider: string;
  provider_ref: string;
  provider_tx_id: string | null;
  status: string;
  payment_method: string | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  metadata: Record<string, any>;
  expires_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export async function createIntent(input: {
  kind: IntentKind;
  restaurantId: number | null;
  supplierId?: number | null;
  orderId?: number | null;
  subscriptionId?: number | null;
  amountCop: number;
  metadata?: Record<string, any>;
  createdBy?: number | null;
  idempotencyKey?: string | null;
  expiresInMinutes?: number;
}): Promise<PaymentIntentRow> {
  const id = crypto.randomUUID();
  const reference = newReference(input.kind);
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 60) * 60 * 1000).toISOString();

  try {
    const result = await query(
      `INSERT INTO payment_intents
         (id, kind, restaurant_id, supplier_id, order_id, subscription_id, amount_cop, currency,
          provider, provider_ref, idempotency_key, metadata, expires_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'COP','wompi',$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id,
        input.kind,
        input.restaurantId,
        input.supplierId ?? null,
        input.orderId ?? null,
        input.subscriptionId ?? null,
        Math.round(input.amountCop),
        reference,
        input.idempotencyKey ?? null,
        JSON.stringify(input.metadata ?? {}),
        expiresAt,
        input.createdBy ?? null,
      ]
    );
    return result.rows[0];
  } catch (err: any) {
    // Reutiliza la intención solo si sigue vigente. Devolver una aprobada o
    // expirada haría que el checkout apunte a una referencia ya usada.
    if (err?.code === '23505' && input.idempotencyKey) {
      const existing = await query('SELECT * FROM payment_intents WHERE idempotency_key = $1', [input.idempotencyKey]);
      if (existing.rowCount && ['creado', 'pendiente'].includes(existing.rows[0].status)) {
        return existing.rows[0];
      }
    }
    throw err;
  }
}

export async function expireStaleIntents(): Promise<number> {
  const result = await query(
    `UPDATE payment_intents
        SET status = 'expirado', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('creado', 'pendiente')
        AND expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP`
  );
  return result.rowCount ?? 0;
}

async function upsertSubscription(
  client: PoolClient,
  restaurantId: number,
  plan: PlanTier,
  providerTxId: string | null,
  period: { start: string; end: string } | null
): Promise<number> {
  const result = await client.query(
    `INSERT INTO subscriptions
       (restaurant_id, plan, status, provider, provider_subscription_id,
        current_period_start, current_period_end)
     VALUES ($1,$2,'activa','wompi',$3,$4,$5)
     ON CONFLICT (restaurant_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = 'activa',
           provider = 'wompi',
           provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, subscriptions.provider_subscription_id),
           current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
           current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
           cancel_at_period_end = FALSE,
           updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [restaurantId, plan, providerTxId, period?.start ?? null, period?.end ?? null]
  );
  return Number(result.rows[0].id);
}

/** Suscripción pendiente de pago (se activa cuando llega la confirmación). */
export async function ensureSubscription(restaurantId: number, plan: PlanTier): Promise<number> {
  const inserted = await query(
    `INSERT INTO subscriptions (restaurant_id, plan, status)
     VALUES ($1,$2,'pendiente')
     ON CONFLICT (restaurant_id) DO NOTHING
     RETURNING id`,
    [restaurantId, plan]
  );
  if (inserted.rowCount) return Number(inserted.rows[0].id);

  // Ya existe: no se cambia el plan hasta que el pago se apruebe.
  const existing = await query('SELECT id FROM subscriptions WHERE restaurant_id = $1', [restaurantId]);
  return Number(existing.rows[0].id);
}

/** Plan gratuito: no pasa por pasarela. */
export async function activateFreePlan(restaurantId: number, plan: PlanTier): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2', [plan, restaurantId]);
    await upsertSubscription(client, restaurantId, plan, null, null);
    await client.query(
      `UPDATE subscriptions
          SET payment_source_id = NULL, cancel_at_period_end = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE restaurant_id = $1`,
      [restaurantId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function applyOrderPaid(client: PoolClient, intent: PaymentIntentRow): Promise<void> {
  if (!intent.order_id) return;
  const result = await client.query(
    `SELECT o.id, o.restaurant_id, o.supplier_id, o.total, o.status,
            COALESCE(s.commission_pct, 5.00) AS commission_pct
       FROM orders o
       JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1
      FOR UPDATE`,
    [intent.order_id]
  );
  if (!result.rowCount) return;
  const order = result.rows[0];

  await client.query(
    `UPDATE orders
        SET payment_status = 'pagado',
            paid_at = CURRENT_TIMESTAMP,
            payment_intent_id = $1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
    [intent.id, intent.order_id]
  );

  // Obligación con el proveedor: bruto, comisión de Xupply y neto a dispersar.
  const gross = Math.round(Number(order.total));
  const pct = Number(order.commission_pct ?? 5);
  const commission = Math.round((gross * pct) / 100);
  const net = gross - commission;

  await client.query(
    `INSERT INTO supplier_settlements
       (supplier_id, order_id, period_start, period_end, gross_cop, commission_cop, fee_cop, net_cop, status)
     VALUES ($1,$2,CURRENT_DATE,CURRENT_DATE,$3,$4,0,$5,'pendiente')
     ON CONFLICT (order_id) DO NOTHING`,
    [order.supplier_id, intent.order_id, gross, commission, net]
  );
}

async function applySubscriptionPaid(client: PoolClient, intent: PaymentIntentRow): Promise<void> {
  if (!intent.restaurant_id) return;
  const plan: PlanTier = isPlanTier(intent.metadata?.plan) ? intent.metadata.plan : 'medio';
  const period = billingPeriod();

  await client.query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2', [plan, intent.restaurant_id]);
  const subscriptionId = await upsertSubscription(client, intent.restaurant_id, plan, intent.provider_tx_id, period);

  await client.query('UPDATE payment_intents SET subscription_id = $1 WHERE id = $2', [subscriptionId, intent.id]);

  await client.query(
    `INSERT INTO subscription_charges
       (subscription_id, period_start, period_end, amount_cop, status, payment_intent_id)
     VALUES ($1,$2,$3,$4,'pagado',$5)
     ON CONFLICT (subscription_id, period_start) DO UPDATE
       SET status = 'pagado',
           payment_intent_id = EXCLUDED.payment_intent_id,
           failure_reason = NULL`,
    [subscriptionId, period.start, period.end, Math.round(Number(intent.amount_cop)), intent.id]
  );

  // Si el restaurante había quedado en mora, se reactiva al pagar.
  await client.query(
    `UPDATE subscriptions
        SET status = 'activa', updated_at = CURRENT_TIMESTAMP
      WHERE restaurant_id = $1 AND status IN ('mora', 'suspendida', 'pendiente')`,
    [intent.restaurant_id]
  );
}

/**
 * Aplica una transacción aprobada de forma idempotente.
 *
 * La transacción se bloquea con FOR UPDATE: si dos webhooks llegan a la vez,
 * solo uno aplica los efectos y el otro sale sin duplicar asientos.
 */
export async function applyApprovedTransaction(tx: {
  id: string;
  reference: string;
  amount_in_cents: number;
  status?: string;
  payment_method_type?: string;
}): Promise<{ handled: boolean; reason?: string; intent?: PaymentIntentRow }> {
  const client = await pool.connect();
  let orderId: number | null = null;
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM payment_intents WHERE provider_ref = $1 FOR UPDATE', [tx.reference]);
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { handled: false, reason: 'intent_not_found' };
    }
    const intent = found.rows[0] as PaymentIntentRow;
    orderId = intent.order_id;

    if (intent.status === 'aprobado') {
      await client.query('ROLLBACK');
      return { handled: false, reason: 'already_approved', intent };
    }

    const expectedCents = toCents(Number(intent.amount_cop));
    if (Number(tx.amount_in_cents) !== expectedCents) {
      await client.query(
        `UPDATE payment_intents
            SET status = 'fallido', provider_tx_id = $1,
                failure_reason = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3`,
        [tx.id, `Monto recibido ${tx.amount_in_cents} != esperado ${expectedCents}`, intent.id]
      );
      await client.query('COMMIT');
      return { handled: true, reason: 'amount_mismatch', intent };
    }

    await client.query(
      `UPDATE payment_intents
          SET status = 'aprobado', provider_tx_id = $1,
              payment_method = $2, failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [tx.id, tx.payment_method_type ?? null, intent.id]
    );

    if (intent.kind === 'pedido') {
      await applyOrderPaid(client, intent);
    } else if (intent.kind === 'suscripcion') {
      await applySubscriptionPaid(client, intent);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Notificación en tiempo real después del commit (si falla, no revierte el pago).
  if (orderId) {
    try {
      const full = await query(
        `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
           FROM orders o
           JOIN restaurants r ON r.id = o.restaurant_id
           JOIN suppliers s ON s.id = o.supplier_id
          WHERE o.id = $1`,
        [orderId]
      );
      if (full.rowCount) emitOrder('order:updated', full.rows[0]);
    } catch {
      /* la notificación es best-effort */
    }
  }

  return { handled: true };
}

export async function applyFailedTransaction(tx: {
  id: string;
  reference: string;
  status: string;
}): Promise<{ handled: boolean; reason?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM payment_intents WHERE provider_ref = $1 FOR UPDATE', [tx.reference]);
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { handled: false, reason: 'intent_not_found' };
    }
    const intent = found.rows[0] as PaymentIntentRow;
    if (intent.status === 'aprobado') {
      // Un rechazo posterior no revierte un pago ya aprobado (se gestiona como reembolso).
      await client.query('ROLLBACK');
      return { handled: false, reason: 'already_approved' };
    }

    await client.query(
      `UPDATE payment_intents
          SET status = 'rechazado', provider_tx_id = $1,
              failure_reason = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [tx.id, `Transacción ${tx.status}`, intent.id]
    );

    if (intent.kind === 'suscripcion' && intent.restaurant_id) {
      await client.query(
        `UPDATE subscriptions
            SET status = 'mora', updated_at = CURRENT_TIMESTAMP
          WHERE restaurant_id = $1 AND status IN ('activa', 'pendiente')`,
        [intent.restaurant_id]
      );
      if (intent.subscription_id) {
        await client.query(
          `UPDATE subscription_charges
              SET status = 'fallido', failure_reason = $1
            WHERE payment_intent_id = $2`,
          [`Transacción ${tx.status}`, intent.id]
        );
      }
    }

    await client.query('COMMIT');
    return { handled: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fallback de polling: si el webhook tarda, se consulta Wompi por referencia.
 * Nunca lanza: un fallo de red no debe romper la consulta del cliente.
 */
export async function syncIntentFromWompi(intent: PaymentIntentRow): Promise<PaymentIntentRow> {
  if (!['creado', 'pendiente'].includes(intent.status)) return intent;
  let tx: WompiTransaction | null = null;
  try {
    tx = await findTransactionByReference(intent.provider_ref);
  } catch {
    return intent;
  }
  if (!tx) return intent;

  if (tx.status === 'APPROVED') {
    await applyApprovedTransaction(tx);
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    await applyFailedTransaction({ id: tx.id, reference: tx.reference, status: tx.status });
  } else {
    return intent;
  }

  const refreshed = await query('SELECT * FROM payment_intents WHERE id = $1', [intent.id]);
  return (refreshed.rows[0] as PaymentIntentRow) ?? intent;
}
