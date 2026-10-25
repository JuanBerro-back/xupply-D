import { query } from '../config/db';
import { sendEmail } from './email';
import { DocType, DOC_LABELS, EntityType, publicAppUrl } from './verification';

type AccountKind = EntityType;

function kindLabel(kind: AccountKind): string {
  return kind === 'restaurante' ? 'restaurante' : 'proveedor';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, intro: string, body: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55">
    <h2 style="margin:0 0 12px;font-size:20px;color:#0369a1">${escapeHtml(title)}</h2>
    <p style="margin:0 0 14px">${intro}</p>
    ${body}
    ${
      cta
        ? `<p style="margin:22px 0"><a href="${escapeHtml(cta.url)}" style="background:#0284c7;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${escapeHtml(
            cta.label
          )}</a></p>
           <p style="margin:0;font-size:12px;color:#64748b">Si el botón no funciona, copia este enlace: ${escapeHtml(cta.url)}</p>`
        : ''
    }
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="margin:0;font-size:12px;color:#64748b">Xupply · Gestión de cuentas empresariales</p>
  </div>`;
}

/** Correo al solicitante: expediente recibido. */
export async function sendRegistrationReceived(params: {
  kind: AccountKind;
  name: string;
  email: string;
  token: string;
}): Promise<void> {
  const link = publicAppUrl(`/verificacion/${params.token}`);
  const subject = `Recibimos tu registro de ${kindLabel(params.kind)} — Xupply`;
  await sendEmail({
    to_email: params.email,
    subject,
    body:
      `Hola ${params.name},\n\n` +
      `Recibimos tu registro de ${kindLabel(params.kind)} en Xupply. Un verificador revisará el RUT, ` +
      `la Cámara de Comercio y la cédula del representante legal.\n\n` +
      `Mientras la cuenta esté en revisión no podrás iniciar sesión. Te avisaremos por este correo ` +
      `cuando esté aprobada o si necesitamos alguna corrección.\n\n` +
      `Puedes seguir el estado aquí: ${link}\n`,
    html: layout(
      'Registro recibido',
      `Hola <strong>${escapeHtml(params.name)}</strong>, recibimos tu registro de <strong>${kindLabel(
        params.kind
      )}</strong> en Xupply.`,
      `<p style="margin:0 0 10px">Un verificador revisará:</p>
       <ul style="margin:0 0 14px;padding-left:20px">
         <li>RUT</li>
         <li>Cámara de Comercio</li>
         <li>Cédula del representante legal</li>
       </ul>
       <p style="margin:0">Mientras la cuenta esté en revisión <strong>no podrás iniciar sesión</strong>. Te avisaremos cuando esté aprobada o si necesitamos correcciones.</p>`,
      { label: 'Ver estado de mi registro', url: link }
    ),
    category: 'transactional',
  });
}

/** Correo al solicitante con la decisión del verificador. */
export async function sendVerificationDecision(params: {
  kind: AccountKind;
  name: string;
  email: string;
  decision: 'aprobar' | 'rechazar' | 'subsanar';
  reason?: string | null;
  token: string;
}): Promise<void> {
  const link = publicAppUrl(`/verificacion/${params.token}`);
  const reason = (params.reason ?? '').trim();

  if (params.decision === 'aprobar') {
    const subject = `Tu cuenta de ${kindLabel(params.kind)} fue aprobada — Xupply`;
    await sendEmail({
      to_email: params.email,
      subject,
      body:
        `Hola ${params.name},\n\n` +
        `Tu cuenta de ${kindLabel(params.kind)} fue verificada y aprobada. Ya puedes iniciar sesión en Xupply.\n\n` +
        `Ingresa en: ${publicAppUrl('/login')}\n`,
      html: layout(
        'Cuenta aprobada',
        `Hola <strong>${escapeHtml(params.name)}</strong>, tu cuenta de <strong>${kindLabel(
          params.kind
        )}</strong> fue verificada y aprobada.`,
        `<p style="margin:0">Ya puedes iniciar sesión y operar en la plataforma.</p>`,
        { label: 'Iniciar sesión', url: publicAppUrl('/login') }
      ),
      category: 'transactional',
    });
    return;
  }

  if (params.decision === 'rechazar') {
    const subject = `Tu registro de ${kindLabel(params.kind)} no fue aprobado — Xupply`;
    await sendEmail({
      to_email: params.email,
      subject,
      body:
        `Hola ${params.name},\n\n` +
        `Revisamos tu registro de ${kindLabel(params.kind)} y no fue aprobado.\n\n` +
        `Motivo: ${reason || 'No especificado'}\n\n` +
        `Si crees que es un error, responde a este correo con los documentos correctos.\n`,
      html: layout(
        'Registro no aprobado',
        `Hola <strong>${escapeHtml(params.name)}</strong>, revisamos tu registro de <strong>${kindLabel(
          params.kind
        )}</strong> y no fue aprobado.`,
        `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px">
           <p style="margin:0;font-size:13px;color:#991b1b"><strong>Motivo:</strong> ${escapeHtml(
             reason || 'No especificado'
           )}</p>
         </div>
         <p style="margin:14px 0 0">Si crees que es un error, responde a este correo con los documentos correctos.</p>`
      ),
      category: 'transactional',
    });
    return;
  }

  const subject = `Necesitamos corregir tu registro de ${kindLabel(params.kind)} — Xupply`;
  await sendEmail({
    to_email: params.email,
    subject,
    body:
      `Hola ${params.name},\n\n` +
      `Para aprobar tu cuenta de ${kindLabel(params.kind)} necesitamos que corrijas o vuelvas a cargar documentos.\n\n` +
      `Observación: ${reason || 'No especificada'}\n\n` +
      `Puedes subir los documentos corregidos aquí: ${link}\n`,
    html: layout(
      'Corrección solicitada',
      `Hola <strong>${escapeHtml(params.name)}</strong>, para aprobar tu cuenta de <strong>${kindLabel(
        params.kind
      )}</strong> necesitamos una corrección.`,
      `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px">
         <p style="margin:0;font-size:13px;color:#92400e"><strong>Observación:</strong> ${escapeHtml(
           reason || 'No especificada'
         )}</p>
       </div>
       <p style="margin:14px 0 0">Sube de nuevo los documentos que correspondan. La cuenta seguirá bloqueada hasta que un verificador la apruebe.</p>`,
      { label: 'Subir documentos corregidos', url: link }
    ),
    category: 'transactional',
  });
}

/** Aviso interno al equipo de verificación. */
export async function notifyReviewers(params: {
  kind: AccountKind;
  name: string;
  nit: string;
  city?: string | null;
  applicant: string;
  token: string;
}): Promise<void> {
  const configured = (process.env.VERIFICATION_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  let recipients = configured;
  if (recipients.length === 0) {
    try {
      const result = await query(
        `SELECT u.email
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE u.is_active = TRUE AND u.email IS NOT NULL AND u.email <> ''
            AND r.name IN ('verificador', 'admin')
          ORDER BY u.id
          LIMIT 5`
      );
      recipients = result.rows.map((row) => row.email).filter(Boolean);
    } catch (err) {
      console.warn('[verification] No se pudieron resolver los correos del equipo:', err);
    }
  }

  if (recipients.length === 0) return;

  const link = publicAppUrl('/admin/verificaciones');
  const subject = `Nueva solicitud de verificación: ${params.name} (${params.nit})`;
  const bodyText =
    `Se recibió un registro de ${kindLabel(params.kind)} pendiente de verificación.\n\n` +
    `Entidad: ${params.name}\nNIT: ${params.nit}\nCiudad: ${params.city || '—'}\n` +
    `Solicitante: ${params.applicant}\n\n` +
    `Revisar en: ${link}\n`;

  for (const to of recipients) {
    await sendEmail({
      to_email: to,
      subject,
      body: bodyText,
      html: layout(
        'Nueva solicitud de verificación',
        `Se recibió un registro de <strong>${kindLabel(params.kind)}</strong> pendiente de revisión.`,
        `<table style="border-collapse:collapse;font-size:13px">
           <tr><td style="padding:4px 10px 4px 0;color:#64748b">Entidad</td><td style="padding:4px 0;font-weight:700">${escapeHtml(
             params.name
           )}</td></tr>
           <tr><td style="padding:4px 10px 4px 0;color:#64748b">NIT</td><td style="padding:4px 0">${escapeHtml(
             params.nit
           )}</td></tr>
           <tr><td style="padding:4px 10px 4px 0;color:#64748b">Ciudad</td><td style="padding:4px 0">${escapeHtml(
             params.city || '—'
           )}</td></tr>
           <tr><td style="padding:4px 10px 4px 0;color:#64748b">Solicitante</td><td style="padding:4px 0">${escapeHtml(
             params.applicant
           )}</td></tr>
         </table>`,
        { label: 'Abrir back office', url: link }
      ),
      category: 'notification',
    });
  }
}

/** Lista legible de documentos faltantes para correos y respuestas. */
export function missingDocumentsLabel(missing: DocType[]): string {
  return missing.map((doc) => DOC_LABELS[doc]).join(', ');
}
