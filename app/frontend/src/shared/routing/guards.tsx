import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasAdminAccess } from '../utils/permissions';
import AccessDenied from '../ui/AccessDenied';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RolesAllowed({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <AccessDenied />;
  return <>{children}</>;
}

export function AdminAccessAllowed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAdminAccess(user)) return <AccessDenied />;
  return <>{children}</>;
}
