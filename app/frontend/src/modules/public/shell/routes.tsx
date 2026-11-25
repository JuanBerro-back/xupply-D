import { Navigate, Route } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { isCapacitorNative } from '../../../shared/api/client';
import { DashboardPage } from '../../operations/dashboard/routes';
import { LandingPage } from '../landing/routes';
import NotFound from './pages/NotFound';

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500 bg-slate-50 dark:bg-[#0b1120] min-h-screen">Cargando...</div>;
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'verificador') return <Navigate to="/admin/verificaciones" replace />;
    if (user.role === 'domiciliario') return <Navigate to="/repartidor" replace />;
    return <DashboardPage />;
  }
  if (isCapacitorNative()) return <Navigate to="/login" replace />;
  return <LandingPage />;
}

export const rootRoute = <Route key="root" path="/" element={<RootRoute />} />;
export const notFoundRoute = <Route key="not-found" path="*" element={<NotFound />} />;
