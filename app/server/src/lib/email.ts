import dotenv from 'dotenv';
import { promises as dns } from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';

dotenv.config();

export interface EmailPayload {
  to_email: string;
  to_name?: string;
  subject: string;
  /** Cuerpo en texto plano. Obligatorio: los filtros antispam penalizan el HTML sin alternativa. */
  body: string;
  /** HTML opcional. Si no se envía, se genera una plantilla corporativa. */
  html?: string;
  reply_to?: string;
  category?: 'transactional' | 'notification';
}

type Provider = 'smtp' | 'resend' | 'emailjs' | 'none';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FREE_MAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
];

let providerLogged = false;
let smtpTransport: Transporter | null = null;

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

function smtpConfigured(): boolean {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'));
}

function resendConfigured(): boolean {
  return Boolean(env('RESEND_API_KEY'));
}

function emailjsConfigured(): boolean {
  return Boolean(env('EMAILJS_SERVICE_ID') && env('EMAILJS_TEMPLATE_ID') && env('EMAILJS_PUBLIC_KEY'));
}

export function getEmailProviderName(): Provider {
  return configuredProviders()[0] ?? 'none';
}

/**
 * Proveedores utilizables, en orden de preferencia. Si `MAIL_PROVIDER` apunta a
 * uno concreto, ese va primero; los demás quedan como respaldo para no perder el
 * correo cuando el primario falla (por ejemplo, SMTP bloqueado en serverless).
 */
export function configuredProviders(): Provider[] {
  const explicit = env('MAIL_PROVIDER').toLowerCase();
  const order: Provider[] = [];
  if (explicit === 'smtp' || explicit === 'resend' || explicit === 'emailjs') order.push(explicit);
  for (const candidate of ['smtp', 'resend', 'emailjs'] as Provider[]) {
    if (!order.includes(candidate)) order.push(candidate);
  }
  return order.filter((provider) => {
    if (provider === 'smtp') return smtpConfigured();
    if (provider === 'resend') return resendConfigured();
    if (provider === 'emailjs') return emailjsConfigured();
    return false;
  });
}

function fromHeader(): string {
  const raw = cleanHeader(env('MAIL_FROM'));
  if (!raw) return '';
  if (raw.includes('<')) return raw;
  const name = cleanHeader(env('MAIL_FROM_NAME') || 'Xupply');
  return `"${name.replace(/"/g, '')}" <${raw}>`;
}

function fromEmail(): string {
  const raw = env('MAIL_FROM');
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function replyToHeader(payload: EmailPayload): string {
  return cleanHeader(payload.reply_to?.trim() || env('MAIL_REPLY_TO') || env('MAIL_FROM'));
}

/** Elimina CR/LF para impedir inyección de cabeceras. */
function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(payload: EmailPayload): string {
  const appUrl = env('APP_URL') || env('CLIENT_ORIGIN') || 'https://xupply.example.com';
  const company = env('MAIL_COMPANY_NAME') || 'Xupply';
  const address = env('MAIL_COMPANY_ADDRESS') || 'Bucaramanga, Santander, Colombia';
  const support = env('MAIL_REPLY_TO') || fromEmail();
  const safeBody = escapeHtml(payload.body).replace(/\r?\n/g, '<br />');
  const greeting = payload.to_name ? `Hola ${escapeHtml(payload.to_name)},` : 'Hola,';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(payload.subject)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:24px 28px 8px 28px;">
                <div style="font-size:20px;font-weight:700;color:#0284c7;letter-spacing:-0.3px;">${escapeHtml(company)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 14px 0;">${greeting}</p>
                <p style="margin:0 0 18px 0;">${safeBody}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 24px 28px;">
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px;">Abrir ${escapeHtml(company)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;">
                <p style="margin:0 0 4px 0;">${escapeHtml(company)} · ${escapeHtml(address)}</p>
                <p style="margin:0;">¿Necesitas ayuda? Escríbenos a <a href="mailto:${escapeHtml(support)}" style="color:#0284c7;">${escapeHtml(support)}</a></p>
                <p style="margin:8px 0 0 0;">Este es un mensaje automático de ${escapeHtml(company)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(payload: EmailPayload): string {
  const company = env('MAIL_COMPANY_NAME') || 'Xupply';
  const address = env('MAIL_COMPANY_ADDRESS') || 'Bucaramanga, Santander, Colombia';
  const support = env('MAIL_REPLY_TO') || fromEmail();
  const greeting = payload.to_name ? `Hola ${payload.to_name},` : 'Hola,';
  return [
    greeting,
    '',
    payload.body,
    '',
    '--',
    `${company} · ${address}`,
    `Soporte: ${support}`,
    `Este es un mensaje automático de ${company}.`,
  ].join('\n');
}

function getSmtpTransport(): Transporter {
  if (smtpTransport) return smtpTransport;
  const port = Number(env('SMTP_PORT') || 587);
  smtpTransport = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: env('SMTP_SECURE') === 'true' || port === 465,
    auth: {
      user: env('SMTP_USER'),
      pass: env('SMTP_PASS'),
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2' },
  });
  return smtpTransport;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendViaSmtp(message: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
}): Promise<boolean> {
  const transport = getSmtpTransport();
  const info = await transport.sendMail({
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
    bcc: env('MAIL_BCC') || undefined,
    headers: {
      'X-Mailer': 'Xupply',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    },
  });
  return Boolean(info?.messageId);
}

async function sendViaResend(message: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
  category: string;
}): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      reply_to: message.replyTo || undefined,
      bcc: env('MAIL_BCC') ? [env('MAIL_BCC')] : undefined,
      headers: {
        'X-Entity-Ref-ID': `${message.category}-${Date.now()}`,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[email] Resend rechazó el envío:', res.status, detail.slice(0, 300));
    return false;
  }
  return true;
}

async function sendViaEmailJs(payload: EmailPayload): Promise<boolean> {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: env('EMAILJS_SERVICE_ID'),
      template_id: env('EMAILJS_TEMPLATE_ID'),
      user_id: env('EMAILJS_PUBLIC_KEY'),
      accessToken: env('EMAILJS_PRIVATE_KEY') || undefined,
      template_params: {
        to_email: payload.to_email,
        to_name: payload.to_name ?? payload.to_email,
        subject: payload.subject,
        body: payload.body,
        message: payload.body,
        from_name: env('MAIL_FROM_NAME') || 'Xupply',
        reply_to: replyToHeader(payload),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[email] EmailJS rechazó el envío:', res.status, detail.slice(0, 300));
    return false;
  }
  return true;
}

function validatePayload(payload: EmailPayload): string | null {
  if (!payload?.to_email || !EMAIL_RE.test(payload.to_email.trim())) return 'destinatario inválido';
  if (!payload.subject || !payload.subject.trim()) return 'asunto vacío';
  if (!payload.body || !payload.body.trim()) return 'cuerpo vacío';
  return null;
}

async function deliver(payload: EmailPayload, provider: Provider): Promise<boolean> {
  const html = payload.html?.trim() || renderHtml(payload);
  const text = renderText(payload);
  const message = {
    from: fromHeader(),
    to: payload.to_email.trim(),
    subject: cleanHeader(payload.subject),
    text,
    html,
    replyTo: replyToHeader(payload),
    category: payload.category ?? 'transactional',
  };

  if (provider === 'smtp') return sendViaSmtp(message);
  if (provider === 'resend') return sendViaResend(message);
  if (provider === 'emailjs') return sendViaEmailJs(payload);
  return false;
}

/**
 * Envía un correo transaccional. Nunca lanza excepciones: un fallo de correo
 * no debe romper la creación de un pedido o una factura.
 *
 * Reintenta hasta 3 veces por proveedor con backoff exponencial y, si el
 * primario falla, intenta con los demás proveedores configurados.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const invalid = validatePayload(payload);
  if (invalid) {
    console.error('[email] Payload inválido:', invalid);
    return false;
  }

  const providers = configuredProviders();
  if (providers.length === 0) {
    console.warn('[email] Sin proveedor configurado; correo omitido:', payload.subject);
    return false;
  }
  if (!providerLogged) {
    providerLogged = true;
    console.log(`[email] Proveedores configurados: ${providers.join(' > ')}`);
  }
  if (!fromHeader() && !providers.includes('emailjs')) {
    console.error('[email] MAIL_FROM no está configurado; el correo no se puede enviar con un remitente válido.');
    return false;
  }

  for (const provider of providers) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const ok = await deliver(payload, provider);
        if (ok) return true;
      } catch (err) {
        console.error(
          `[email] Intento ${attempt}/3 falló (${provider}):`,
          (err as Error)?.message || err
        );
      }
      if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }
    if (providers.length > 1) {
      console.warn(`[email] Proveedor ${provider} agotado; probando el siguiente.`);
    }
  }
  console.error('[email] No se pudo enviar el correo:', payload.subject, '→', payload.to_email);
  return false;
}

/** Estado no sensible para diagnóstico y health checks internos. */
export function getEmailStatus() {
  const provider = getEmailProviderName();
  const from = fromEmail();
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  if (provider === 'none') warnings.push('No hay proveedor de correo configurado.');
  if (provider !== 'none' && isProduction && from && FREE_MAIL_DOMAINS.includes(from.split('@')[1] ?? '')) {
    warnings.push('MAIL_FROM usa un dominio gratuito; usa un dominio corporativo para evitar spam.');
  }
  if (provider !== 'none' && isProduction && !env('MAIL_REPLY_TO')) {
    warnings.push('MAIL_REPLY_TO no está configurado; las respuestas irán al remitente.');
  }
  if (provider === 'smtp' && env('SMTP_USER') && from) {
    const smtpDomain = (env('SMTP_USER').split('@')[1] ?? '').toLowerCase();
    const fromDomain = (from.split('@')[1] ?? '').toLowerCase();
    if (smtpDomain && fromDomain && smtpDomain !== fromDomain) {
      warnings.push('El dominio de SMTP_USER no coincide con MAIL_FROM (SPF/DKIM podrían fallar).');
    }
  }

  return {
    provider,
    providers: configuredProviders(),
    from: from || null,
    reply_to: env('MAIL_REPLY_TO') || null,
    bcc: env('MAIL_BCC') || null,
    configured: provider !== 'none',
    warnings,
  };
}

/** Diagnóstico DNS de entregabilidad (SPF/DKIM/DMARC/MX) del dominio remitente. */
export interface EmailDnsReport {
  domain: string;
  spf: { found: boolean; record: string | null; multiple: boolean };
  dmarc: { found: boolean; policy: string | null; record: string | null };
  dkim: { found: boolean; selector: string | null };
  mx: { found: boolean; records: number };
  checked_at: string;
  warnings: string[];
}

const DNS_TIMEOUT_MS = 4_000;
const DNS_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DKIM_SELECTORS = [
  'google',
  'selector1',
  'selector2',
  'resend',
  'amazonses',
  'sib',
  'zoho',
  'default',
  'mail',
  'k1',
];

const dnsCache = new Map<string, { at: number; report: EmailDnsReport }>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function resolveTxtRecords(name: string): Promise<string[]> {
  try {
    const records = await withTimeout(dns.resolveTxt(name), DNS_TIMEOUT_MS);
    return records.map((parts) => parts.join('').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Comprueba SPF, DKIM, DMARC y MX del dominio de `MAIL_FROM` para detectar por
 * qué un correo cae en spam. No lanza excepciones: devuelve `null` sin dominio.
 * Los resultados se cachean 10 minutos para no consultar DNS en cada petición.
 */
export async function checkEmailDns(force = false): Promise<EmailDnsReport | null> {
  const domain = (fromEmail().split('@')[1] ?? '').trim().toLowerCase();
  if (!domain) return null;

  const cached = dnsCache.get(domain);
  if (!force && cached && Date.now() - cached.at < DNS_CACHE_TTL_MS) return cached.report;

  const warnings: string[] = [];

  const rootTxt = await resolveTxtRecords(domain);
  const spfRecords = rootTxt.filter((record) => /^v=spf1\b/i.test(record));
  const spf = {
    found: spfRecords.length > 0,
    record: spfRecords[0] ?? null,
    multiple: spfRecords.length > 1,
  };
  if (!spf.found) {
    warnings.push('No hay registro SPF en el dominio: muchos filtros lo penalizan.');
  } else if (spf.multiple) {
    warnings.push('Hay más de un registro SPF: se invalidan entre sí. Deja solo uno.');
  } else if (!/[~-]all\b/i.test(spfRecords[0])) {
    warnings.push('El SPF no termina en ~all o -all: añade una política final.');
  }

  const dmarcRecords = (await resolveTxtRecords(`_dmarc.${domain}`)).filter((record) =>
    /^v=DMARC1\b/i.test(record)
  );
  const policy = dmarcRecords[0]?.match(/\bp\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() ?? null;
  const dmarc = { found: dmarcRecords.length > 0, policy, record: dmarcRecords[0] ?? null };
  if (!dmarc.found) {
    warnings.push('No hay DMARC en _dmarc.<dominio>: Gmail/Outlook pueden enviar a spam.');
  } else if (policy === 'none') {
    warnings.push('DMARC está en p=none (solo monitoreo); pasa a quarantine cuando los reportes estén limpios.');
  }

  const configuredSelectors = (env('MAIL_DKIM_SELECTORS') || env('MAIL_DKIM_SELECTOR') || '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
  const selectors = configuredSelectors.length > 0 ? configuredSelectors : DEFAULT_DKIM_SELECTORS;
  let dkimSelector: string | null = null;
  for (const selector of selectors) {
    const records = (await resolveTxtRecords(`${selector}._domainkey.${domain}`)).filter((record) =>
      /v=DKIM1|(^|;)\s*p=/i.test(record)
    );
    if (records.length > 0) {
      dkimSelector = selector;
      break;
    }
  }
  const dkim = { found: Boolean(dkimSelector), selector: dkimSelector };
  if (!dkim.found) {
    warnings.push(
      'No se encontró DKIM con los selectores habituales. Configúralo en tu proveedor o define MAIL_DKIM_SELECTORS.'
    );
  }

  let mxRecords = 0;
  try {
    mxRecords = (await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS)).length;
  } catch {
    mxRecords = 0;
  }
  if (mxRecords === 0) {
    warnings.push('El dominio no tiene MX: no podrá recibir respuestas al buzón enterprise.');
  }

  const report: EmailDnsReport = {
    domain,
    spf,
    dmarc,
    dkim,
    mx: { found: mxRecords > 0, records: mxRecords },
    checked_at: new Date().toISOString(),
    warnings,
  };
  dnsCache.set(domain, { at: Date.now(), report });
  return report;
}

/** Envía un correo de prueba a un destinatario concreto. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; status: ReturnType<typeof getEmailStatus> }> {
  const status = getEmailStatus();
  const ok = await sendEmail({
    to_email: to,
    to_name: 'Equipo Xupply',
    subject: `Prueba de correo Xupply — ${new Date().toISOString()}`,
    body:
      'Este es un correo de prueba enviado desde el backend de Xupply.\n\n' +
      'Si lo ves en la bandeja de entrada (no en spam), la configuración SPF/DKIM/DMARC y el remitente están correctos.',
    category: 'transactional',
  });
  return { ok, status };
}
