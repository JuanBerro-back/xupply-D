import { query } from '../../../shared/config/db';
import { RESTAURANT_COLUMNS, BRANCH_COLUMNS } from './restaurants.service';

export function getRestaurantById(id: number | string) {
  return query(`SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE id = $1 AND is_active = TRUE`, [id]);
}

export function getMyRestaurant(id: number | string) {
  return query(`SELECT ${RESTAURANT_COLUMNS} FROM restaurants r WHERE r.id = $1`, [id]);
}

export function getBranches(restaurantId: number | string) {
  return query(`SELECT ${BRANCH_COLUMNS} FROM branches WHERE restaurant_id = $1 ORDER BY is_main DESC, name`, [restaurantId]);
}

export function createBranchRow(restaurantId: number, name: string, address: unknown, phone: unknown, isMain: unknown) {
  return query(
    `INSERT INTO branches (restaurant_id, name, address, phone, is_main)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${BRANCH_COLUMNS}`,
    [restaurantId, name, address, phone, isMain]
  );
}
