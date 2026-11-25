import { Request, Response, NextFunction } from 'express';
import { query } from '../../shared/config/db';
import { clearPermissionCache } from '../../shared/middleware/auth';
import bcrypt from 'bcryptjs';
import { logAudit } from '../../shared/lib/audit';
import { emitToUser, emitToRole } from '../../shared/lib/realtime';
import { getEmailStatus, sendTestEmail, checkEmailDns } from '../../shared/lib/email';
import { normalizeTenantIdsForRole, validateTenantScope } from '../../shared/lib/userTenant';
import { pagination } from './admin.service';
import { usernameExists, getRoleName, restaurantExists, branchExists, supplierExists, findUserById, countActiveAdmins, listRoles as listRolesRow, findRoleById, roleNameExists, findRole, updatePassword, forceLogout, deleteUser as deleteUserRow } from './admin.repository';

const emailTestCooldown = new Map<number, number>();

export async function getEmailStatusRoute(_req: Request, res: Response) {
  const status = getEmailStatus();
  res.json({
    provider: status.provider,
    providers: status.providers,
    from: status.from,
    reply_to: status.reply_to,
    configured: status.configured,
    warnings: status.warnings,
  });
}

export async function checkEmailDnsRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const refresh = String(req.query.refresh ?? '') === '1';
    const report = await checkEmailDns(refresh);
    if (!report) {
      return res.status(400).json({ error: 'MAIL_FROM no est├í configurado; no hay dominio que verificar.' });
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function sendEmailTest(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const now = Date.now();
    const last = emailTestCooldown.get(user.id) ?? 0;
    if (now - last < 60_000) {
      return res.status(429).json({ error: 'Espera un minuto antes de enviar otra prueba.' });
    }

    const result = await query('SELECT email FROM users WHERE id = $1', [user.id]);
    const to = String(result.rows[0]?.email ?? '').trim();
    if (!to) {
      return res.status(400).json({ error: 'Tu usuario no tiene un correo configurado.' });
    }

    emailTestCooldown.set(user.id, now);
    await logAudit(req, 'email_test', 'user', user.id, null, { provider: getEmailStatus().provider });
    const outcome = await sendTestEmail(to);
    res.json({
      ok: outcome.ok,
      sent_to: to,
      provider: outcome.status.provider,
      warnings: outcome.status.warnings,
    });
  } catch (err) {
    next(err);
  }
}
