import dotenv from 'dotenv';
import { checkEmailDns, getEmailStatus, sendTestEmail } from '../src/lib/email';

dotenv.config();

async function main() {
  const to = (process.argv[2] || process.env.TEST_EMAIL_TO || '').trim();
  if (!to) {
    console.error('Uso: npm run email:test -- correo@tu-dominio.com');
    process.exit(1);
  }

  const status = getEmailStatus();
  console.log('Proveedor :', status.provider);
  console.log('Respaldo  :', status.providers.join(' > ') || '(ninguno)');
  console.log('From      :', status.from ?? '(sin configurar)');
  console.log('Reply-To  :', status.reply_to ?? '(sin configurar)');
  console.log('BCC       :', status.bcc ?? '(sin configurar)');
  if (status.warnings.length > 0) {
    for (const warning of status.warnings) console.warn('ADVERTENCIA:', warning);
  }
  if (!status.configured) {
    console.error('No hay proveedor de correo configurado. Revisa .env.example / EMAIL-ENTERPRISE.md');
    process.exit(1);
  }

  console.log('\nComprobando DNS (SPF/DKIM/DMARC/MX)...');
  const dnsReport = await checkEmailDns(true);
  if (!dnsReport) {
    console.warn('No se pudo verificar DNS: MAIL_FROM no está configurado.');
  } else {
    console.log(`Dominio   : ${dnsReport.domain}`);
    console.log(`SPF       : ${dnsReport.spf.found ? 'OK' : 'FALTA'} ${dnsReport.spf.record ?? ''}`.trim());
    console.log(`DKIM      : ${dnsReport.dkim.found ? `OK (selector ${dnsReport.dkim.selector})` : 'NO ENCONTRADO'}`);
    console.log(
      `DMARC     : ${dnsReport.dmarc.found ? `OK (p=${dnsReport.dmarc.policy ?? '?'})` : 'FALTA'}`
    );
    console.log(`MX        : ${dnsReport.mx.found ? `${dnsReport.mx.records} registro(s)` : 'FALTA'}`);
    for (const warning of dnsReport.warnings) console.warn('ADVERTENCIA DNS:', warning);
  }

  console.log(`\nEnviando correo de prueba a ${to}...`);
  const result = await sendTestEmail(to);
  if (result.ok) {
    console.log('OK: correo aceptado por el proveedor. Revisa la bandeja de entrada (y spam).');
    process.exit(0);
  }
  console.error('ERROR: el proveedor rechazó el envío. Revisa los logs anteriores.');
  process.exit(1);
}

main().catch((err) => {
  console.error('ERROR inesperado:', (err as Error)?.message || err);
  process.exit(1);
});
