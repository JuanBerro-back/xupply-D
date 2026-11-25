import { query } from '../../../shared/config/db';
import { SUPPLIER_COLUMNS } from './suppliers.service';

export function getSupplierById(id: number | string | null) {
  return query(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE id = $1`, [id]);
}

export function getActiveSupplierById(id: number | string) {
  return query(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE id = $1 AND is_active = TRUE`, [id]);
}
