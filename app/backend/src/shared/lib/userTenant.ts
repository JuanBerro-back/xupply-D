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
    case 'verificador':
      return 'platform';
    default:
      return 'unknown';
  }
}

export interface TenantIds {
  restaurant_id?: number | null;
  supplier_id?: number | null;
}

export interface NormalizableTenantIds extends TenantIds {
  branch_id?: number | null;
}

/**
 * Deduce el inquilino del rol antes de validarlo: los roles de plataforma no
 * conservan restaurante ni proveedor, y un cambio de rol entre restaurante y
 * proveedor descarta el inquilino que ya no aplica.
 *
 * No consulta la BD: normaliza solo los valores que le llegan.
 */
export function normalizeTenantIdsForRole(
  roleName: string | undefined | null,
  ids: NormalizableTenantIds
): { restaurant_id: number | null; branch_id: number | null; supplier_id: number | null } {
  let restaurant_id = ids.restaurant_id ?? null;
  let branch_id = ids.branch_id ?? null;
  let supplier_id = ids.supplier_id ?? null;

  const scope = tenantScopeForRole(roleName);
  if (scope === 'restaurant') {
    supplier_id = null;
  } else if (scope === 'supplier') {
    restaurant_id = null;
    branch_id = null;
  } else if (scope === 'platform') {
    restaurant_id = null;
    branch_id = null;
    supplier_id = null;
  }

  return { restaurant_id, branch_id, supplier_id };
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
    return `El rol '${roleName}' requiere un restaurante (restaurant_id).`;
  }
  if (scope === 'supplier' && !ids.supplier_id) {
    return `El rol '${roleName}' requiere un proveedor (supplier_id).`;
  }
  if (scope === 'platform' && (ids.restaurant_id || ids.supplier_id)) {
    return `El rol '${roleName}' es de plataforma: no debe tener restaurante ni proveedor.`;
  }
  return null;
}
