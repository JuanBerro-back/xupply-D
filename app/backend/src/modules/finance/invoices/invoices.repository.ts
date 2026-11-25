import { query } from '../../../shared/config/db';

export function getInvoiceById(id: number | string) {
  return query(`SELECT * FROM invoices WHERE id = $1`, [id]);
}

export function getInvoiceItems(id: number | string) {
  return query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
}
