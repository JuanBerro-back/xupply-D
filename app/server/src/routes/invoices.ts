import { Router } from 'express';
import { query, pool } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { sendEmail } from '../lib/email';

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
    const result = await query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
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

router.patch('/:id/status', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { status } = req.body;
    const valid = ['borrador', 'emitida', 'pagada', 'anulada'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    const paidSql = status === 'pagada' ? ', paid_at = CURRENT_TIMESTAMP' : '';
    const result = await query(
      `UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP${paidSql} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
    if (status === 'pagada' && user.restaurant_id) {
      await query(
        `INSERT INTO accounting_transactions (restaurant_id, type, amount, description, reference_type, reference_id, payment_method, transaction_date, created_by)
         SELECT restaurant_id, 'ingreso', total, 'Factura ' || invoice_code, 'invoice', id, payment_method, CURRENT_DATE, $2
         FROM invoices WHERE id = $1`,
        [req.params.id, user.id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;