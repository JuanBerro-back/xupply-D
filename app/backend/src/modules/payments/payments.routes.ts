import { Router } from 'express';
import express from 'express';
import { authRequired, roleRequired } from '../../shared/middleware/auth';
import {
  getConfig,
  checkoutOrder,
  checkoutSubscription,
  getIntent,
  getMySubscription,
  cancelSubscription,
  createPaymentMethod,
  listSettlements,
  paySettlement,
  wompiWebhook,
  subscriptionsCron,
} from './payments.controller';

// ---------------------------------------------------------------------------
// Router autenticado (montado en /api/payments)
// ---------------------------------------------------------------------------
export const paymentsRouter = Router();
paymentsRouter.use(authRequired);

/** Estado de la pasarela para el frontend (sin exponer llaves). */
paymentsRouter.get('/config', getConfig);

/**
 * Crea (o reutiliza) el checkout de un pedido.
 * El monto SIEMPRE sale de orders.total, nunca del cliente.
 */
paymentsRouter.post(
  '/checkout/order/:id',
  roleRequired('gerente', 'empleado', 'admin'),
  checkoutOrder
);

/** Checkout de suscripción. El plan básico se activa sin pasarela. */
paymentsRouter.post('/checkout/subscription', roleRequired('gerente'), checkoutSubscription);

/** Estado de una intención (polling del frontend). */
paymentsRouter.get('/intents/:id', getIntent);

/** Suscripción del restaurante autenticado. */
paymentsRouter.get('/subscriptions/me', roleRequired('gerente', 'admin'), getMySubscription);

/** Cancela la renovación (sigue activo hasta el final del periodo pagado). */
paymentsRouter.post('/subscriptions/cancel', roleRequired('gerente'), cancelSubscription);

/**
 * Tokeniza una tarjeta para cobros recurrentes.
 * El navegador crea el token con la llave pública de Wompi; aquí solo se
 * convierte en fuente de pago con la llave privada.
 */
paymentsRouter.post('/methods', roleRequired('gerente'), createPaymentMethod);

/** Liquidaciones al proveedor (solo back office). */
paymentsRouter.get('/admin/settlements', roleRequired('admin'), listSettlements);

/**
 * Registra el pago de una liquidación.
 * El payout se ejecuta en Wompi (Payouts) o por transferencia manual; aquí se
 * guarda el identificador para conciliación.
 */
paymentsRouter.post('/admin/settlements/:id/pay', roleRequired('admin'), paySettlement);

// ---------------------------------------------------------------------------
// Webhooks (montados ANTES del parser JSON global en app.ts)
// ---------------------------------------------------------------------------
export const paymentsWebhookRouter = Router();

paymentsWebhookRouter.post(
  '/wompi',
  express.raw({ type: '*/*', limit: '2mb' }),
  wompiWebhook
);

// ---------------------------------------------------------------------------
// Cron interno (montado en /api/internal)
// ---------------------------------------------------------------------------
export const paymentsCronRouter = Router();

paymentsCronRouter.post('/cron/subscriptions', subscriptionsCron);
// Vercel Cron invoca por GET; se aceptan ambos métodos.
paymentsCronRouter.get('/cron/subscriptions', subscriptionsCron);
