// Tipos del dominio admin.
export interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_name: string;
  role_label: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  restaurant_id: number | null;
  branch_id: number | null;
  supplier_id: number | null;
  restaurant_name?: string;
  branch_name?: string;
  supplier_name?: string;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
}

export interface TenantOpt {
  id: number;
  name: string;
}

export type RoleScope = 'restaurant' | 'supplier' | 'platform';

export interface AdminUserFormState {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  role_id: number;
  restaurant_id: string;
  branch_id: string;
  supplier_id: string;
  vehicle_type: string;
  vehicle_plate: string;
}
