// Tipos del dominio team.
export interface TeamUser {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role_name: string;
  role_label?: string;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
}

export interface TeamRoleOption {
  id: number;
  name: string;
  label: string;
}

export interface TeamFormState {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  role_id: number;
  vehicle_type: string;
  vehicle_plate: string;
}
