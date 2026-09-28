import { Router } from 'express';
import { query, pool } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { sendEmail } from '../lib/email';
import { logAudit } from '../lib/audit';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `SELECT i.*, r.name AS restaurant_name, s.name AS supplier_name
               FROM invoices i
               JOIN restaurants r ON r.id = i.restaurant_id
               LEFT JOIN suppliers s ON s.id = i.supplier_id
               WHERE 1=1`;
    if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND i.restaurant_id = $${params.length}`;
    }
    if (user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND i.supplier_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND i.status = $${params.length}`;
    }
    sql += ' ORDER BY i.created_at DESC LIMIT 200';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
    if (user.role !== 'admin' && result.rows[0].restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [req.params.id]);
    res.json({ ...result.rows[0], items: items.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'Solo restaurantes crean facturas' });
    const { order_id, items, payment_method, client_name, client_id_number, client_id_type, client_email } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requieren ítems de factura' });
    }
    const client = await pool.connect();
    try {
      if (order_id) {
        const orderCheck = await client.query('SELECT 1 FROM orders WHERE id = $1 AND restaurant_id = $2', [order_id, user.restaurant_id]);
        if (!orderCheck.rowCount) {
          client.release();
          return res.status(400).json({ error: `El order_id ${order_id} no existe o no pertenece a tu restaurante` });
        }
      }
      
      await client.query('BEGIN');
      const code = `INV-${Date.now().toString(36).toUpperCase()}`;
      let subtotal = 0;
      for (const it of items) {
        subtotal += Number(it.quantity) * Number(it.unit_price);
      }
      const iva = subtotal * 0.19;
      const impoconsumo = subtotal * 0.08;
      const total = subtotal + iva + impoconsumo;
      const inserted = await client.query(
        `INSERT INTO invoices (invoice_code, mode, restaurant_id, order_id, client_name, client_id_number, client_id_type, client_email, subtotal, iva_amount, impoconsumo_amount, total, payment_method, status, created_by)
         VALUES ($1, 'electronica', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'emitida', $13)
         RETURNING id`,
        [code, user.restaurant_id, order_id, client_name, client_id_number, client_id_type ?? 'cedula', client_email, subtotal, iva, impoconsumo, total, payment_method ?? 'Efectivo', user.id]
      );
      const invoiceId = inserted.rows[0].id;
      for (const it of items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [invoiceId, it.description, it.quantity, it.unit_price, Number(it.quantity) * Number(it.unit_price)]
        );
      }
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'create', 'invoice', $2, $3::jsonb)`,
        [user.id, invoiceId, JSON.stringify({ code, total })]
      );
      await client.query('COMMIT');
      const invoice = await query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
      if (client_email) {
        sendEmail({
          to_email: client_email,
          to_name: client_name ?? client_email,
          subject: `Factura ${code}`,
          body: `Tu factura ${code} por $${total} está disponible en Xupply.`,
        });
      }
      res.status(201).json(invoice.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

const INVOICE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['emitida', 'anulada'],
  emitida: ['pagada', 'anulada'],
  pagada: ['anulada'],
  anulada: [],
};

router.patch('/:id/status', roleRequired('gerente', 'admin'), async (req, res, next) => {
  let client;
  try {
    const user = req.user!;
    const { status, motivo } = req.body;
    
    const valid = ['borrador', 'emitida', 'pagada', 'anulada'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    
    if (status === 'anulada' && (!motivo || String(motivo).trim().length < 5)) {
      return res.status(400).json({ error: 'Motivo de anulación requerido (mínimo 5 caracteres)' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    
    const prevQuery = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!prevQuery.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const prev = prevQuery.rows[0];

    if (user.role !== 'admin' && prev.restaurant_id !== user.restaurant_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!INVOICE_TRANSITIONS[prev.status]?.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `No se puede pasar de ${prev.status} a ${status}` });
    }
    
    let extraSql = '';
    if (status === 'pagada') extraSql = ', paid_at = CURRENT_TIMESTAMP';
    if (status === 'emitida') extraSql = ', issued_at = COALESCE(issued_at, CURRENT_TIMESTAMP)';
    let params: any[] = [status, req.params.id];
    if (status === 'anulada' && motivo) {
      extraSql += ', motivo = $3';
      params.push(motivo);
    }
    
    const result = await client.query(
      `UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP${extraSql} WHERE id = $2 RETURNING *`,
      params
    );
    
    if (status === 'pagada') {
      const exists = await client.query("SELECT id FROM accounting_transactions WHERE reference_type = $1 AND reference_id = $2 AND type = 'ingreso'", ['invoice', req.params.id]);
      if (!exists.rowCount) {
        await client.query(
          `INSERT INTO accounting_transactions (restaurant_id, type, amount, description, reference_type, reference_id, payment_method, transaction_date, created_by)
           SELECT restaurant_id, 'ingreso', total, 'Factura ' || invoice_code, 'invoice', id, payment_method, CURRENT_DATE, $2
           FROM invoices WHERE id = $1`,
          [req.params.id, user.id]
        );
      }
    } else if (status === 'anulada' && prev.status === 'pagada') {
      // Reversión contable al anular una pagada: se asienta el egreso en vez de borrar el ingreso (decisión de negocio)
      await client.query(
        `INSERT INTO accounting_transactions (restaurant_id, type, amount, description, reference_type, reference_id, payment_method, transaction_date, created_by)
         SELECT restaurant_id, 'egreso', total, 'Anulación factura ' || invoice_code, 'invoice', id, payment_method, CURRENT_DATE, $2
         FROM invoices WHERE id = $1`,
        [req.params.id, user.id]
      );
    }
    
    await client.query('COMMIT');
    
    await logAudit(req, 'update', 'invoice', Number(req.params.id), { status: prev.status }, { status, motivo });
    
    res.json(result.rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
});

export default router;