import { PaymentIntentRow } from './payments';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appUrl(): string {
  const raw = (process.env.APP_URL || process.env.CLIENT_ORIGIN || 'https://xupply-d.vercel.app')
    .split(',')[0]
    .trim();
  return raw.replace(/\/+$/, '');
}

export function currency(): string {
  return (process.env.WOMPI_CURRENCY || 'COP').trim() || 'COP';
}

/** Cuerpo exacto de la respuesta 503 cuando Wompi no está configurado. */
export function paymentNotConfiguredPayload() {
  return {
    error: 'La pasarela de pagos no está configurada',
    code: 'PAYMENTS_NOT_CONFIGURED',
  };
}

export function safeIntent(intent: PaymentIntentRow) {
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
