/**
 * Invariantes de rol / inquilino (tenant) para altas y cambios de usuario.
 *
 * Cada rol vive en un ámbito distinto:
 *  - "restaurant": gerente y empleado pertenecen a un restaurante (restaurant_id).
 *  - "supplier":  proveedor_admin y domiciliario pertenecen a un proveedor (supplier_id).
 *  - "platform":  admin es de plataforma y no debe tener restaurante ni proveedor.
 *
 * Validar esto evita usuarios "sin inquilino" que rompen el aislamiento multi-tenant
 * (listados vacíos, 403 confusos y potencial acceso cruzado).
 */

export type TenantScope = 'restaurant' | 'supplier' | 'platform' | 'unknown';

export function tenantScopeForRole(roleName: string | undefined | null): TenantScope {
  switch (roleName) {
    case 'gerente':
    case 'empleado':
      return 'restaurant';
    case 'proveedor_admin':
    case 'domiciliario':
      return 'supplier';
    case 'admin':
      return 'platform';
    default:
      return 'unknown';
  }
}

export interface TenantIds {
  restaurant_id?: number | null;
  supplier_id?: number | null;
}

/**
 * Devuelve un mensaje de error si el rol no es coherente con el inquilino recibido,
 * o `null` si la combinación es válida.
 */
export function validateTenantScope(
  roleName: string | undefined | null,
  ids: TenantIds
): string | null {
  const scope = tenantScopeForRole(roleName);

  if (scope === 'restaurant' && !ids.restaurant_id) {
    return 'Este rol requiere un restaurante (restaurant_id).';
  }
  if (scope === 'supplier' && !ids.supplier_id) {
    return 'Este rol requiere un proveedor (supplier_id).';
  }
  if (scope === 'platform' && (ids.restaurant_id || ids.supplier_id)) {
    return 'El rol admin es de plataforma: no debe tener restaurante ni proveedor.';
  }
  return null;
}
