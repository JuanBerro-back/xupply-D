// Columnas compartidas por las consultas del dominio de restaurantes.
export const RESTAURANT_COLUMNS = `id, name, nit, phone, email, address, city, department, logo_url,
                            description, cover_url, category, subscription_plan, is_active, created_at, updated_at`;
export const BRANCH_COLUMNS = 'id, restaurant_id, name, address, phone, is_main, is_active, created_at, updated_at';
