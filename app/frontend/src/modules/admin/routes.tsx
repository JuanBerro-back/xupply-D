import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { AdminAccessAllowed } from '../../shared/routing/guards';
import { useAuth } from '../../shared/context/AuthContext';
import AdminLayout from './components/AdminLayout';
const UsuariosAdmin = lazy(() => import('./pages/UsuariosAdmin'));
const RolesAdmin = lazy(() => import('./pages/RolesAdmin'));
const PermisosAdmin = lazy(() => import('./pages/PermisosAdmin'));
const ComerciosAdmin = lazy(() => import('./pages/ComerciosAdmin'));
const AuditoriaAdmin = lazy(() => import('./pages/AuditoriaAdmin'));
const VerificacionesAdmin = lazy(() => import('./pages/VerificacionesAdmin'));

/** /admin para el verificador (sin permiso de configuración) va al back office. */
export function AdminIndex() {
  const { user } = useAuth();
  const canConfig = user?.role === 'admin' || !!user?.permissions?.includes('config');
  if (!canConfig) return <Navigate to="/admin/verificaciones" replace />;
  return <AuditoriaAdmin />;
}

export const adminRoutes: React.ReactElement[] = [
  <Route key="admin" path="/admin" element={<AdminAccessAllowed><AdminLayout /></AdminAccessAllowed>}>
    <Route index element={<AdminIndex />} />
    <Route path="usuarios" element={<UsuariosAdmin />} />
    <Route path="roles" element={<RolesAdmin />} />
    <Route path="permisos" element={<PermisosAdmin />} />
    <Route path="comercios" element={<ComerciosAdmin />} />
    <Route path="verificaciones" element={<VerificacionesAdmin />} />
  </Route>,
];
