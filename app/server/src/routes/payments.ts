import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import {
  isPlanTier,
  PLAN_LABELS,
  PLAN_PRICES_COP,
  PlanTier,
  activateFreePlan,
  applyApprovedTransaction,
  applyFailedTransaction,
  billingPeriod,
  createIntent,
  ensureSubscription,
  expireStaleIntents,
  PaymentIntentRow,
  syncIntentFromWompi,
} from '../lib/payments';
import {
  buildCheckoutUrl,
  chargePaymentSource,
  createPaymentSource,
  getTransaction,
  isWompiConfiguredForCharges,
  verifyEventSignature,
  wompiConfig,
} from '../lib/wompi';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appUrl(): string {
  const raw = (process.env.APP_URL || process.env.CLIENT_ORIGIN || 'https://xupply-d.vercel.app')
    .split(',')[0]
    .trim();
  return raw.replace(/\/+$/, '');
}

function currency(): string {
  return (process.env.WOMPI_CURRENCY || 'COP').trim() || 'COP';
}

function safeIntent(intent: PaymentIntentRow) {
  return {
    id: intent.id,
    kind: intent.kind,
    status: intent.status,
    amount_cop: Number(intent.amount_cop),
    currency: intent.currency,
    reference: intent.provider_ref,
    order_id: intent.order_id,
    subscription_id: intent.subscription_id,
    metadata: intent.metadata,
    failure_reason: intent.failure_reason,
    provider_tx_id: intent.provider_tx_id,
    created_at: intent.created_at,
    updated_at: intent.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Router autenticado (montado en /api/payments)
// ---------------------------------------------------------------------------
export const paymentsRouter = Router();
paymentsRouter.use(authRequired);

/** Estado de la pasarela para el frontend (sin exponer llaves). */
paymentsRouter.get('/config', (_req, res) => {
  const cfg = wompiConfig();
  res.json({
    provider: 'wompi',
    enabled: cfg.enabled,
    environment: cfg.env,
    currency: currency(),
    plans: PLAN_PRICES_COP,
  });
});

/**
 * Crea (o reutiliza) el checkout de un pedido.
 * El monto SIEMPRE sale de orders.total, nunca del cliente.
 */
paymentsRouter.post(
  '/checkout/order/:id',
  roleRequired('gerente', 'empleado', 'admin'),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Pedido inválido' });
      }

      const result = await query(
        `SELECT o.id, o.order_code, o.restaurant_id, o.supplier_id, o.total,
                o.status, o.payment_status, r.email AS restaurant_email, r.name AS restaurant_name
           FROM orders o
           JOIN restaurants r ON r.id = o.restaurant_id
          WHERE o.id = $1`,
        [orderId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
      const order = result.rows[0];

      if (user.role !== 'admin' && order.restaurant_id !== user.restaurant_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      if (order.status === 'cancelado') {
        return res.status(409).json({ error: 'El pedido está cancelado' });
      }
      if (order.payment_status === 'pagado') {
        return res.status(409).json({ error: 'El pedido ya está pagado', code: 'ALREADY_PAID' });
      }

      const amountCop = Math.round(Number(order.total));
      if (!Number.isFinite(amountCop) || amountCop <= 0) {
        return res.status(400).json({ error: 'El pedido no tiene un total válido para cobrar' });
      }

      const cfg = wompiConfig();
      if (!cfg.enabled) {
        return res.status(503).json({
          error: 'La pasarela de pagos no está configurada',
          code: 'PAYMENTS_NOT_CONFIGURED',
        });
      }

      // Reutiliza el checkout pendiente para no generar cobros duplicados.
      let intent: PaymentIntentRow | undefined = (
        await query(
          `SELECT * FROM payment_intents
            WHERE order_id = $1 AND kind = 'pedido' AND status IN ('creado', 'pendiente')
            ORDER BY created_at DESC LIMIT 1`,
          [orderId]
        )
      ).rows[0];

      if (intent && Number(intent.amount_cop) !== amountCop) {
        await query(
          `UPDATE payment_intents SET status = 'expirado', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [intent.id]
        );
        intent = undefined;
      }

      if (!intent) {
        intent = await createIntent({
          kind: 'pedido',
          restaurantId: order.restaurant_id,
          supplierId: order.supplier_id,
          orderId,
          amountCop,
          createdBy: user.id,
          metadata: { order_code: order.order_code },
        });
      }

      const checkoutUrl = buildCheckoutUrl({
        reference: intent.provider_ref,
        amountCop,
        redirectUrl: `${appUrl()}/pago/resultado?intent=${intent.id}`,
        customerEmail: order.restaurant_email || undefined,
        customerFullName: order.restaurant_name || undefined,
      });

      await logAudit(req, 'create', 'payment_intent', null, null, {
        intent_id: intent.id,
        kind: 'pedido',
        order_id: orderId,
        amount_cop: amountCop,
      });

      return res.status(201).json({
        intent_id: intent.id,
        reference: intent.provider_ref,
        amount_cop: amountCop,
        checkout_url: checkoutUrl,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** Checkout de suscripción. El plan básico se activa sin pasarela. */
paymentsRouter.post('/checkout/subscription', roleRequired('gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) {
      return res.status(403).json({ error: 'Solo los restaurantes tienen suscripción' });
    }
    const plan = req.body?.plan;
    if (!isPlanTier(plan)) {
      return res.status(400).json({ error: 'Plan inválido. Usa basico, medio o premium' });
    }

    if (plan === 'basico') {
      await activateFreePlan(user.restaurant_id, plan);
      await query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2', [plan, user.restaurant_id]);
      await logAudit(req, 'update', 'subscription', null, null, { plan, source: 'free' });
      return res.json({ activated: true, plan, amount_cop: 0 });
    }

    const amountCop = PLAN_PRICES_COP[plan];
    const cfg = wompiConfig();
    if (!cfg.enabled) {
      return res.status(503).json({
        error: 'La pasarela de pagos no está configurada',
        code: 'PAYMENTS_NOT_CONFIGURED',
      });
    }

    const subscriptionId = await ensureSubscription(user.restaurant_id, plan);

    let intent: PaymentIntentRow | undefined = (
      await query(
        `SELECT * FROM payment_intents
          WHERE kind = 'suscripcion' AND restaurant_id = $1
            AND status IN ('creado', 'pendiente')
            AND metadata->>'plan' = $2
          ORDER BY created_at DESC LIMIT 1`,
        [user.restaurant_id, plan]
      )
    ).rows[0];

    if (intent && Number(intent.amount_cop) !== amountCop) {
      await query(
        `UPDATE payment_intents SET status = 'expirado', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [intent.id]
      );
      intent = undefined;
    }

    if (!intent) {
      intent = await createIntent({
        kind: 'suscripcion',
        restaurantId: user.restaurant_id,
        subscriptionId,
        amountCop,
        createdBy: user.id,
        metadata: { plan },
      });
    }

    const tenant = await query('SELECT name, email FROM restaurants WHERE id = $1', [user.restaurant_id]);

    const checkoutUrl = buildCheckoutUrl({
      reference: intent.provider_ref,
      amountCop,
      redirectUrl: `${appUrl()}/pago/resultado?intent=${intent.id}`,
      customerEmail: tenant.rows[0]?.email || undefined,
      customerFullName: tenant.rows[0]?.name || undefined,
    });

    await logAudit(req, 'create', 'payment_intent', null, null, {
      intent_id: intent.id,
      kind: 'suscripcion',
      plan,
      amount_cop: amountCop,
    });

    return res.status(201).json({
      intent_id: intent.id,
      reference: intent.provider_ref,
      plan,
      plan_label: PLAN_LABELS[plan],
      amount_cop: amountCop,
      checkout_url: checkoutUrl,
    });
  } catch (err) {
    next(err);
  }
});

/** Estado de una intención (polling del frontend). */
paymentsRouter.get('/intents/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Intención inválida' });

    const result = await query('SELECT * FROM payment_intents WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Intención no encontrada' });
    let intent = result.rows[0] as PaymentIntentRow;

    const owns = intent.restaurant_id === user.restaurant_id || intent.created_by === user.id;
    if (user.role !== 'admin' && !owns) return res.status(403).json({ error: 'No autorizado' });

    if (req.query.sync === '1') {
      intent = await syncIntentFromWompi(intent);
    }

    return res.json(safeIntent(intent));
  } catch (err) {
    next(err);
  }
});

/** Suscripción del restaurante autenticado. */
paymentsRouter.get('/subscriptions/me', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const restaurantId = user.role === 'admin' ? Number(req.query.restaurant_id) || null : user.restaurant_id;
    if (!restaurantId) return res.status(400).json({ error: 'restaurant_id requerido' });

    const sub = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [restaurantId]);
    const charges = await query(
      `SELECT sc.*, pi.status AS intent_status
         FROM subscription_charges sc
         LEFT JOIN payment_intents pi ON pi.id = sc.payment_intent_id
        WHERE sc.subscription_id = $1
        ORDER BY sc.period_start DESC
        LIMIT 24`,
      [sub.rows[0]?.id ?? 0]
    );
    const plan = (sub.rows[0]?.plan as PlanTier) ?? 'basico';

    return res.json({
      subscription: sub.rows[0] ?? null,
      plan,
      plan_label: PLAN_LABELS[plan] ?? plan,
      price_cop: PLAN_PRICES_COP[plan] ?? 0,
      charges: charges.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** Cancela la renovación (sigue activo hasta el final del periodo pagado). */
paymentsRouter.post('/subscriptions/cancel', roleRequired('gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes' });

    const result = await query(
      `UPDATE subscriptions
          SET cancel_at_period_end = TRUE,
              status = CASE WHEN plan = 'basico' THEN 'cancelada' ELSE status END,
              updated_at = CURRENT_TIMESTAMP
        WHERE restaurant_id = $1
        RETURNING *`,
      [user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'No hay suscripción activa' });

    await logAudit(req, 'update', 'subscription', null, null, { cancel_at_period_end: true });
    return res.json({ ok: true, subscription: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * Tokeniza una tarjeta para cobros recurrentes.
 * El navegador crea el token con la llave pública de Wompi; aquí solo se
 * convierte en fuente de pago con la llave privada.
 */
paymentsRouter.post('/methods', roleRequired('gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes' });
    const cardToken = String(req.body?.card_token || '').trim();
    const customerEmail = String(req.body?.customer_email || '').trim();
    if (!cardToken || !customerEmail) {
      return res.status(400).json({ error: 'card_token y customer_email son requeridos' });
    }

    const source = await createPaymentSource({ cardToken, customerEmail });
    await query(
      `UPDATE subscriptions SET payment_source_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE restaurant_id = $2`,
      [String(source.id), user.restaurant_id]
    );

    return res.status(201).json({ payment_source_id: source.id, status: source.status ?? 'ACTIVE' });
  } catch (err) {
    next(err);
  }
});

/** Liquidaciones al proveedor (solo back office). */
paymentsRouter.get('/admin/settlements', roleRequired('admin'), async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (status) {
      params.push(status);
      where += ` AND ss.status = $${params.length}`;
    }
    if (supplierId) {
      params.push(supplierId);
      where += ` AND ss.supplier_id = $${params.length}`;
    }

    const result = await query(
      `SELECT ss.*, s.name AS supplier_name, o.order_code
         FROM supplier_settlements ss
         JOIN suppliers s ON s.id = ss.supplier_id
         LEFT JOIN orders o ON o.id = ss.order_id
         ${where}
        ORDER BY ss.created_at DESC
        LIMIT 200`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * Registra el pago de una liquidación.
 * El payout se ejecuta en Wompi (Payouts) o por transferencia manual; aquí se
 * guarda el identificador para conciliación.
 */
paymentsRouter.post('/admin/settlements/:id/pay', roleRequired('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payoutId = String(req.body?.provider_payout_id || '').trim();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Liquidación inválida' });
    if (!payoutId) {
      return res.status(400).json({
        error: 'provider_payout_id es requerido (ejecuta el payout en Wompi y registra el ID)',
        code: 'PAYOUT_ID_REQUIRED',
      });
    }

    const result = await query(
      `UPDATE supplier_settlements
          SET status = 'pagada', provider_payout_id = $1, paid_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND status IN ('pendiente', 'enviada')
        RETURNING *`,
      [payoutId, id]
    );
    if (!result.rowCount) {
      return res.status(409).json({ error: 'La liquidación no existe o ya fue pagada' });
    }
    await logAudit(req, 'update', 'supplier_settlement', id, null, { status: 'pagada', provider_payout_id: payoutId });
    return res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Webhooks (montados ANTES del parser JSON global en app.ts)
// ---------------------------------------------------------------------------
export const paymentsWebhookRouter = Router();

paymentsWebhookRouter.post(
  '/wompi',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req: Request, res: Response) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const rawText = raw.toString('utf8');
    let payload: any;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      return res.status(400).json({ error: 'JSON inválido' });
    }

    const eventId = crypto.createHash('sha256').update(rawText).digest('hex');
    const eventType = String(payload?.event ?? 'unknown');
    const signatureOk = verifyEventSignature(payload);

    // Idempotencia: la huella del cuerpo identifica el evento.
    const inserted = await query(
      `INSERT INTO payment_events (provider, event_id, event_type, signature_ok, payload)
       VALUES ('wompi', $1, $2, $3, $4)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [eventId, eventType, signatureOk, JSON.stringify(payload ?? {})]
    );
    if (!inserted.rowCount) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    const eventRowId = inserted.rows[0].id;

    if (!signatureOk) {
      await query(`UPDATE payment_events SET error = $1 WHERE id = $2`, ['Firma inválida', eventRowId]);
      console.warn('[Wompi] Webhook con firma inválida rechazado');
      return res.status(401).json({ error: 'Firma inválida' });
    }

    if (eventType !== 'transaction.updated') {
      await query('UPDATE payment_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1', [eventRowId]);
      return res.status(200).json({ received: true, ignored: eventType });
    }

    const incoming = payload?.data?.transaction;
    if (!incoming?.id || !incoming?.reference) {
      await query('UPDATE payment_events SET processed_at = CURRENT_TIMESTAMP, error = $1 WHERE id = $2', [
        'Evento sin transaction.id/reference',
        eventRowId,
      ]);
      return res.status(200).json({ received: true, ignored: 'incomplete' });
    }

    try {
      // Fuente de verdad: se consulta la transacción a Wompi, no se confía en el
      // cuerpo del webhook (que podría reenviarse manipulado).
      let tx = incoming;
      if ((process.env.WOMPI_VERIFY_TRANSACTION ?? 'true').toLowerCase() !== 'false') {
        tx = await getTransaction(String(incoming.id));
      } else {
        console.warn('[Wompi] WOMPI_VERIFY_TRANSACTION=false: se confía en el payload del webhook');
      }

      if (tx.status === 'APPROVED') {
        await applyApprovedTransaction({
          id: String(tx.id),
          reference: String(tx.reference),
          amount_in_cents: Number(tx.amount_in_cents),
          status: tx.status,
          payment_method_type: tx.payment_method_type,
        });
      } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(String(tx.status))) {
        await applyFailedTransaction({
          id: String(tx.id),
          reference: String(tx.reference),
          status: String(tx.status),
        });
      }

      await query('UPDATE payment_events SET processed_at = CURRENT_TIMESTAMP, error = NULL WHERE id = $1', [
        eventRowId,
      ]);
      return res.status(200).json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await query('UPDATE payment_events SET error = $1 WHERE id = $2', [message.slice(0, 500), eventRowId]);
      console.error('[Wompi] Error procesando webhook:', message);
      // 500 para que Wompi reintente.
      return res.status(500).json({ error: 'Error procesando el evento' });
    }
  }
);

// ---------------------------------------------------------------------------
// Cron interno (montado en /api/internal)
// ---------------------------------------------------------------------------
export const paymentsCronRouter = Router();

const subscriptionsCronHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = (process.env.CRON_SECRET || '').trim();
    if (!secret) {
      return res.status(503).json({ error: 'CRON_SECRET no configurado' });
    }
    if (req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const expired = await expireStaleIntents();
    const due = await query(
      `SELECT s.*, r.name AS restaurant_name, r.email AS restaurant_email
         FROM subscriptions s
         JOIN restaurants r ON r.id = s.restaurant_id
        WHERE s.status IN ('activa', 'mora')
          AND s.cancel_at_period_end = FALSE
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end <= CURRENT_DATE
        ORDER BY s.current_period_end ASC
        LIMIT 100`
    );

    let charged = 0;
    let failed = 0;
    let skipped = 0;

    for (const sub of due.rows) {
      const plan: PlanTier = isPlanTier(sub.plan) ? sub.plan : 'medio';
      const period = billingPeriod();

      if (plan === 'basico') {
        await query(
          `UPDATE subscriptions
              SET current_period_start = $1, current_period_end = $2, status = 'activa', updated_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
          [period.start, period.end, sub.id]
        );
        skipped += 1;
        continue;
      }

      if (!sub.payment_source_id || !isWompiConfiguredForCharges()) {
        await query(
          `UPDATE subscriptions SET status = 'mora', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [sub.id]
        );
        skipped += 1;
        continue;
      }

      const amountCop = PLAN_PRICES_COP[plan];
      const intent = await createIntent({
        kind: 'suscripcion',
        restaurantId: sub.restaurant_id,
        subscriptionId: sub.id,
        amountCop,
        metadata: { plan, period_start: period.start, automatic: true },
      });

      try {
        const tx = await chargePaymentSource({
          reference: intent.provider_ref,
          amountCop,
          customerEmail: sub.restaurant_email || `restaurante-${sub.restaurant_id}@xupply.co`,
          paymentSourceId: sub.payment_source_id,
        });
        if (tx.status === 'APPROVED') {
          await applyApprovedTransaction(tx);
          charged += 1;
        } else {
          await applyFailedTransaction({ id: tx.id, reference: tx.reference, status: tx.status });
          failed += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          `UPDATE payment_intents
              SET status = 'fallido', failure_reason = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
          [message.slice(0, 500), intent.id]
        );
        await query(
          `UPDATE subscriptions SET status = 'mora', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [sub.id]
        );
        failed += 1;
      }
    }

    return res.json({
      ok: true,
      expired_intents: expired,
      due: due.rowCount,
      charged,
      failed,
      skipped,
    });
  } catch (err) {
    next(err);
  }
};

paymentsCronRouter.post('/cron/subscriptions', subscriptionsCronHandler);
// Vercel Cron invoca por GET; se aceptan ambos métodos.
paymentsCronRouter.get('/cron/subscriptions', subscriptionsCronHandler);
