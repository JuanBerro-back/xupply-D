import { query } from '../../../shared/config/db';

export function fetchCategories() {
  return query('SELECT * FROM product_categories ORDER BY sort_order');
}
