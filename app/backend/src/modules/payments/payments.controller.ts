import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { query } from '../../shared/config/db';
import { logAudit } from '../../shared/lib/audit';
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
} from './payments';
import {
  buildCheckoutUrl,
  chargePaymentSource,
  createPaymentSource,
  getTransaction,
  isWompiConfiguredForCharges,
  verifyEventSignature,
  wompiConfig,
} from './wompi';
import { UUID_RE, appUrl, currency, paymentNotConfiguredPayload, safeIntent } from './payments.service';
import { findIntentById, findRestaurantContact, setRestaurantPlan, findSubscriptionByRestaurant, markPaymentEventProcessed } from './payments.repository';

export function getConfig(_req: Request, res: Response) {
  const cfg = wompiConfig();
  res.json({
    provider: 'wompi',
    enabled: cfg.enabled,
    environment: cfg.env,
    currency: currency(),
    plans: PLAN_PRICES_COP,
  });
}

export async function checkoutOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: 'Pedido inv├ílido' });
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
        return res.status(409).json({ error: 'El pedido est├í cancelado' });
      }
      if (order.payment_status === 'pagado') {
        return res.status(409).json({ error: 'El pedido ya est├í pagado', code: 'ALREADY_PAID' });
      }

      const amountCop = Math.round(Number(order.total));
      if (!Number.isFinite(amountCop) || amountCop <= 0) {
        return res.status(400).json({ error: 'El pedido no tiene un total v├ílido para cobrar' });
      }

      const cfg = wompiConfig();
      if (!cfg.enabled) {
        return res.status(503).json(paymentNotConfiguredPayload());
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

export async function checkoutSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.restaurant_id) {
      return res.status(403).json({ error: 'Solo los restaurantes tienen suscripci├│n' });
    }
    const plan = req.body?.plan;
    if (!isPlanTier(plan)) {
      return res.status(400).json({ error: 'Plan inv├ílido. Usa basico, medio o premium' });
    }

    if (plan === 'basico') {
      await activateFreePlan(user.restaurant_id, plan);
      await setRestaurantPlan(plan, user.restaurant_id);
      await logAudit(req, 'update', 'subscription', null, null, { plan, source: 'free' });
      return res.json({ activated: true, plan, amount_cop: 0 });
    }

    const amountCop = PLAN_PRICES_COP[plan];
    const cfg = wompiConfig();
    if (!cfg.enabled) {
      return res.status(503).json({
        error: 'La pasarela de pagos no est├í configurada',
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

    const tenant = await findRestaurantContact(user.restaurant_id);

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
}

export async function getIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Intenci├│n inv├ílida' });

    const result = await findIntentById(id);
    if (!result.rowCount) return res.status(404).json({ error: 'Intenci├│n no encontrada' });
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
}

export async function getMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const restaurantId = user.role === 'admin' ? Number(req.query.restaurant_id) || null : user.restaurant_id;
    if (!restaurantId) return res.status(400).json({ error: 'restaurant_id requerido' });

    const sub = await findSubscriptionByRestaurant(restaurantId);
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
}

export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
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
    if (!result.rowCount) return res.status(404).json({ error: 'No hay suscripci├│n activa' });

    await logAudit(req, 'update', 'subscription', null, null, { cancel_at_period_end: true });
    return res.json({ ok: true, subscription: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createPaymentMethod(req: Request, res: Response, next: NextFunction) {
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
}

export async function listSettlements(req: Request, res: Response, next: NextFunction) {
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
}

export async function paySettlement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const payoutId = String(req.body?.provider_payout_id || '').trim();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Liquidaci├│n inv├ílida' });
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
      return res.status(409).json({ error: 'La liquidaci├│n no existe o ya fue pagada' });
    }
    await logAudit(req, 'update', 'supplier_settlement', id, null, { status: 'pagada', provider_payout_id: payoutId });
    return res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function wompiWebhook(req: Request, res: Response) {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const rawText = raw.toString('utf8');
    let payload: any;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      return res.status(400).json({ error: 'JSON inv├ílido' });
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
      await query(`UPDATE payment_events SET error = $1 WHERE id = $2`, ['Firma inv├ílida', eventRowId]);
      console.warn('[Wompi] Webhook con firma inv├ílida rechazado');
      return res.status(401).json({ error: 'Firma inv├ílida' });
    }

    if (eventType !== 'transaction.updated') {
      await markPaymentEventProcessed(eventRowId);
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
      // Fuente de verdad: se consulta la transacci├│n a Wompi, no se conf├¡a en el
      // cuerpo del webhook (que podr├¡a reenviarse manipulado).
      let tx = incoming;
      if ((process.env.WOMPI_VERIFY_TRANSACTION ?? 'true').toLowerCase() !== 'false') {
        tx = await getTransaction(String(incoming.id));
      } else {
        console.warn('[Wompi] WOMPI_VERIFY_TRANSACTION=false: se conf├¡a en el payload del webhook');
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

export async function subscriptionsCron(req: Request, res: Response, next: NextFunction) {
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
}
