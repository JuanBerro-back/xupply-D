import dotenv from 'dotenv';

dotenv.config();

export interface EmailPayload {
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log('[email] EmailJS no configurado, correo omitido:', payload.subject);
    return false;
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: payload,
    }),
  });
  if (!res.ok) {
    console.error('[email] Error EmailJS:', res.status, res.statusText);
    return false;
  }
  return true;
}