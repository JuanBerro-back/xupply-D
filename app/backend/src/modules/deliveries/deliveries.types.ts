export type DeliveryUser = {
  role: string;
  id: number;
  supplier_id: number | null;
  restaurant_id: number | null;
};

export type DeliveryRow = Record<string, any>;
