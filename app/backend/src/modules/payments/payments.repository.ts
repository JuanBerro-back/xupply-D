import { query } from '../../shared/config/db';
import { PlanTier } from './payments';

export function findIntentById(id: string) {
  return query('SELECT * FROM payment_intents WHERE id = $1', [id]);
}

export function findRestaurantContact(restaurantId: number) {
  return query('SELECT name, email FROM restaurants WHERE id = $1', [restaurantId]);
}

export function setRestaurantPlan(plan: PlanTier, restaurantId: number) {
  return query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2', [plan, restaurantId]);
}

export function findSubscriptionByRestaurant(restaurantId: number | string | null) {
  return query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [restaurantId]);
}

export function markPaymentEventProcessed(eventRowId: number | string) {
  return query('UPDATE payment_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1', [eventRowId]);
}
