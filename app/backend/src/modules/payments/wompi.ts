import crypto from 'crypto';

/**
 * Cliente mínimo de Wompi (Colombia).
 *
 * Flujos soportados:
 *  - Web Checkout (pago único: pedido o primer mes de suscripción).
 *  - Verificación server-side de transacciones y de la firma de webhooks.
 *  - Cobro recurrente con fuentes de pago tokenizadas (suscripciones).
 *
 * Variables de entorno:
 *   WOMPI_ENV=sandbox|production
 *   WOMPI_PUBLIC_KEY=pub_test_...
 *   WOMPI_PRIVATE_KEY=prv_test_...
 *   WOMPI_INTEGRITY_SECRET=prod_integrity_...
 *   WOMPI_EVENTS_SECRET=prod_events_...
 *   WOMPI_CHECKOUT_URL=https://checkout.wompi.co/p/
 *   WOMPI_VERIFY_TRANSACTION=true
 */

const SANDBOX_BASE = 'https://sandbox.wompi.co/v1';
const PRODUCTION_BASE = 'https://production.wompi.co/v1';

export class WompiError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status = 502, detail?: unknown) {
    super(message);
    this.name = 'WompiError';
    this.status = status;
    this.detail = detail;
  }
}

export interface WompiConfig {
  env: 'sandbox' | 'production';
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  apiBase: string;
  checkoutBase: string;
  enabled: boolean;
}

export function wompiConfig(): WompiConfig {
  const env = (process.env.WOMPI_ENV || 'sandbox').trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  const publicKey = (process.env.WOMPI_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.WOMPI_PRIVATE_KEY || '').trim();
  const integritySecret = (process.env.WOMPI_INTEGRITY_SECRET || '').trim();
  const eventsSecret = (process.env.WOMPI_EVENTS_SECRET || '').trim();
  return {
    env,
    publicKey,
    privateKey,
    integritySecret,
    eventsSecret,
    apiBase: env === 'production' ? PRODUCTION_BASE : SANDBOX_BASE,
    checkoutBase: (process.env.WOMPI_CHECKOUT_URL || 'https://checkout.wompi.co/p/').replace(/\/*$/, '/'),
    // Para iniciar un checkout basta la llave pública y el secreto de integridad.
    enabled: Boolean(publicKey && integritySecret),
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** COP no tiene centavos, pero Wompi siempre recibe centavos. */
export function toCents(amountCop: number): number {
  return Math.round(Number(amountCop) * 100);
}

/** Firma de integridad del Web Checkout: reference + amount_in_cents + currency + secreto. */
export function integritySignature(reference: string, amountInCents: number, currency = 'COP'): string {
  const cfg = wompiConfig();
  return sha256(`${reference}${amountInCents}${currency}${cfg.integritySecret}`);
}

export interface CheckoutInput {
  reference: string;
  amountCop: number;
  redirectUrl?: string;
  customerEmail?: string;
  customerFullName?: string;
  customerPhone?: string;
}

export function buildCheckoutUrl(input: CheckoutInput): string {
  const cfg = wompiConfig();
  if (!cfg.enabled) {
    throw new WompiError('Wompi no está configurado (WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET)', 503);
  }
  const amountInCents = toCents(input.amountCop);
  const params = new URLSearchParams({
    'public-key': cfg.publicKey,
    currency: 'COP',
    'amount-in-cents': String(amountInCents),
    reference: input.reference,
    'signature:integrity': integritySignature(input.reference, amountInCents),
  });
  if (input.redirectUrl) params.set('redirect-url', input.redirectUrl);
  if (input.customerEmail) {
    params.set('customer-data:email', input.customerEmail);
    if (input.customerFullName) params.set('customer-data:full-name', input.customerFullName);
    if (input.customerPhone) params.set('customer-data:phone-number', input.customerPhone);
  }
  return `${cfg.checkoutBase}?${params.toString()}`;
}

/**
 * Verifica la firma de un evento de Wompi.
 *
 * checksum = SHA256( valores de signature.properties + timestamp + events_secret )
 */
export function verifyEventSignature(payload: any): boolean {
  const cfg = wompiConfig();
  if (!cfg.eventsSecret) return false;
  const properties: unknown = payload?.signature?.properties;
  const checksum: unknown = payload?.signature?.checksum;
  if (!Array.isArray(properties) || properties.length === 0 || typeof checksum !== 'string') return false;

  const data = payload?.data ?? {};
  const values = properties.map((prop) => {
    if (typeof prop !== 'string') return '';
    const value = prop.split('.').reduce<any>((acc, key) => (acc == null ? acc : acc[key]), data);
    return value == null ? '' : String(value);
  });

  const expected = sha256(`${values.join('')}${String(payload.timestamp ?? '')}${cfg.eventsSecret}`);
  return safeEqualHex(expected, checksum);
}

async function wompiRequest<T = any>(path: string, init: RequestInit = {}, requiresAuth = true): Promise<T> {
  const cfg = wompiConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  if (requiresAuth) {
    if (!cfg.privateKey) throw new WompiError('WOMPI_PRIVATE_KEY no configurada', 503);
    headers.Authorization = `Bearer ${cfg.privateKey}`;
  }

  const res = await fetch(`${cfg.apiBase}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const reason = body?.error?.reason || body?.error?.message || `Wompi respondió ${res.status}`;
    throw new WompiError(reason, 502, body);
  }
  return (body?.data ?? body) as T;
}

export interface WompiTransaction {
  id: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING' | string;
  reference: string;
  amount_in_cents: number;
  currency?: string;
  payment_method_type?: string;
}

export async function getTransaction(id: string): Promise<WompiTransaction> {
  return wompiRequest<WompiTransaction>(`/transactions/${encodeURIComponent(id)}`);
}

/** Búsqueda por referencia (fallback cuando el webhook aún no ha llegado). */
export async function findTransactionByReference(reference: string): Promise<WompiTransaction | null> {
  const data = await wompiRequest<any>(`/transactions?reference=${encodeURIComponent(reference)}`);
  const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return (list[0] as WompiTransaction) ?? null;
}

/** Token de aceptación de términos exigido para cobros con fuente de pago. */
export async function getAcceptanceToken(): Promise<string> {
  const cfg = wompiConfig();
  if (!cfg.publicKey) throw new WompiError('WOMPI_PUBLIC_KEY no configurada', 503);
  const data = await wompiRequest<any>(`/merchants/${encodeURIComponent(cfg.publicKey)}`, {}, false);
  const token = data?.presigned_acceptance?.acceptance_token;
  if (!token) throw new WompiError('Wompi no devolvió acceptance_token', 502, data);
  return token;
}

/** Crea una fuente de pago (tarjeta tokenizada en el navegador con la llave pública). */
export async function createPaymentSource(input: {
  cardToken: string;
  customerEmail: string;
}): Promise<{ id: number | string; status?: string }> {
  const acceptanceToken = await getAcceptanceToken();
  return wompiRequest('/payment_sources', {
    method: 'POST',
    body: JSON.stringify({
      type: 'CARD',
      token: input.cardToken,
      customer_email: input.customerEmail,
      acceptance_token: acceptanceToken,
    }),
  });
}

/** Cobro recurrente contra una fuente de pago tokenizada. */
export async function chargePaymentSource(input: {
  reference: string;
  amountCop: number;
  customerEmail: string;
  paymentSourceId: string | number;
}): Promise<WompiTransaction> {
  const acceptanceToken = await getAcceptanceToken();
  return wompiRequest<WompiTransaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      amount_in_cents: toCents(input.amountCop),
      currency: 'COP',
      customer_email: input.customerEmail,
      reference: input.reference,
      payment_source_id: Number(input.paymentSourceId),
      payment_method: { type: 'CARD', installments: 1 },
      acceptance_token: acceptanceToken,
    }),
  });
}

export function isWompiConfiguredForCharges(): boolean {
  const cfg = wompiConfig();
  return Boolean(cfg.publicKey && cfg.privateKey && cfg.integritySecret);
}
