import { EntityType, VerificationStatus } from '../utils/verification';

export type EntityRow = {
  entity_type: EntityType;
  id: number;
  name: string;
  nit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  legal_rep_name: string | null;
  legal_rep_document: string | null;
  verification_status: VerificationStatus;
  verification_reason: string | null;
  submitted_at: string | null;
  created_at: string;
};
