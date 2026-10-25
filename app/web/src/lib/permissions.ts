import { User } from '../types';

export const hasAdminAccess = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.role === 'verificador' ||
    !!user.permissions?.includes('config') ||
    !!user.permissions?.includes('verificacion')
  );
};

export const canVerifyAccounts = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.role === 'verificador' ||
    !!user.permissions?.includes('verificacion')
  );
};
