/** Tipos compartidos dentro del módulo `deliveries` (no se exponen a otros módulos). */
export type DriverOption = {
  id: number;
  name: string;
  username: string;
  phone?: string;
  role_label?: string;
  role_name?: string;
};

export type VehicleFormState = {
  name: string;
  plate: string;
  type: string;
  driver_id: string;
  driver_name: string;
  imei: string;
};
