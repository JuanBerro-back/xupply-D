import { User } from '../types';

export const hasAdminAccess = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return user.role === 'admin' || !!user.permissions?.includes('config');
};
