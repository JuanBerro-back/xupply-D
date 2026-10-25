import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isCapacitorNative } from './lib/api';
import { useAuth } from './context/AuthContext';
import CookieConsent from './components/CookieConsent';
import FeedbackHost from './components/FeedbackHost';
import AppErrorBoundary from './components/AppErrorBoundary';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';

// "Chrome" de la app en carga diferida: en el landing público (sin sesión) no
// se renderiza, así que su código no se descarga ni se ejecuta.
const Navbar = lazy(() => import('./components/Navbar'));
const BottomNav = lazy(() => import('./components/BottomNav'));
const SideCart = lazy(() => import('./components/SideCart'));
const AiFloatingWidget = lazy(() => import('./components/AiFloatingWidget'));
import AdminLayout from './components/AdminLayout';

// Carga diferida (code splitting) de las páginas. Reduce el bundle inicial y
// el trabajo del hilo principal en el primer render (mejora LCP/TBT).
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Landing = lazy(() => import('./pages/Landing'));
const Catalog = lazy(() => import('./pages/Catalog'));
const CartPage = lazy(() => import('./pages/CartPage'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PosiblesClientes = lazy(() => import('./pages/PosiblesClientes'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Deliveries = lazy(() => import('./pages/Deliveries'));
const Plans = lazy(() => import('./pages/Plans'));
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const Radar = lazy(() => import('./pages/Radar'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const DownloadApp = lazy(() => import('./pages/DownloadApp'));
const UsuariosAdmin = lazy(() => import('./pages/admin/UsuariosAdmin'));
const RolesAdmin = lazy(() => import('./pages/admin/RolesAdmin'));
const PermisosAdmin = lazy(() => import('./pages/admin/PermisosAdmin'));
const AuditoriaAdmin = lazy(() => import('./pages/admin/AuditoriaAdmin'));
const ComerciosAdmin = lazy(() => import('./pages/admin/ComerciosAdmin'));
const ComercioProfile = lazy(() => import('./pages/ComercioProfile'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const VerificationStatusPage = lazy(() => import('./pages/VerificationStatus'));
const VerificacionesAdmin = lazy(() => import('./pages/admin/VerificacionesAdmin'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RolesAllowed({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <AccessDenied />;
  return <>{children}</>;
}

import { hasAdminAccess } from './lib/permissions';

function AdminAccessAllowed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAdminAccess(user)) return <AccessDenied />;
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500 bg-slate-50 dark:bg-[#0b1120] min-h-screen">Cargando...</div>;
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'verificador') return <Navigate to="/admin/verificaciones" replace />;
    // El domiciliario entra directo a su ruta (experiencia tipo DiDi).
    if (user.role === 'domiciliario') return <Navigate to="/repartidor" replace />;
    return <Dashboard />;
  }
  if (isCapacitorNative()) return <Navigate to="/login" replace />;
  return <Landing />;
}

/** /admin para el verificador (sin permiso de configuración) va al back office. */
function AdminIndex() {
  const { user } = useAuth();
  const canConfig = user?.role === 'admin' || !!user?.permissions?.includes('config');
  if (!canConfig) return <Navigate to="/admin/verificaciones" replace />;
  return <AuditoriaAdmin />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-500">Cargando…</div>}>
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0b1120] dark:text-slate-100 antialiased transition-colors duration-300">
      {user && <Navbar />}
      <main className={user ? 'mx-auto max-w-7xl px-4 py-6 pb-24 sm:pb-6' : ''}>
        <AppErrorBoundary>
        <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-500">Cargando…</div>}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/verificacion/:token" element={<VerificationStatusPage />} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/descargar" element={<DownloadApp />} />
          <Route path="/catalogo" element={<RolesAllowed roles={['admin', 'gerente', 'empleado', 'proveedor_admin']}><Catalog /></RolesAllowed>} />
          <Route path="/carrito" element={<RolesAllowed roles={['gerente', 'empleado']}><CartPage /></RolesAllowed>} />
          <Route path="/pedidos" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/inventario" element={<RolesAllowed roles={['gerente', 'empleado']}><Inventory /></RolesAllowed>} />
          <Route path="/radar" element={<RolesAllowed roles={['admin', 'gerente', 'empleado', 'proveedor_admin']}><Radar /></RolesAllowed>} />
          <Route path="/facturacion" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><Invoices /></RolesAllowed>} />
          <Route path="/contabilidad" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><Accounting /></RolesAllowed>} />
          <Route path="/proveedores" element={<RequireAuth><Suppliers /></RequireAuth>} />
          <Route path="/clientes" element={<RolesAllowed roles={['proveedor_admin', 'admin']}><PosiblesClientes /></RolesAllowed>} />
          <Route path="/logistica" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin', 'domiciliario']}><Deliveries /></RolesAllowed>} />
          <Route path="/planes" element={<RolesAllowed roles={['admin', 'gerente']}><Plans /></RolesAllowed>} />
          <Route path="/xupply-ia" element={<RequireAuth><AiAssistant /></RequireAuth>} />
          <Route path="/equipo" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><TeamManagement /></RolesAllowed>} />
          <Route path="/repartidor" element={<RolesAllowed roles={['domiciliario', 'admin']}><DriverDashboard /></RolesAllowed>} />
          
          {/* Rutas de Administración */}
          <Route path="/admin" element={<AdminAccessAllowed><AdminLayout /></AdminAccessAllowed>}>
            <Route index element={<AdminIndex />} />
            <Route path="usuarios" element={<UsuariosAdmin />} />
            <Route path="roles" element={<RolesAdmin />} />
            <Route path="permisos" element={<PermisosAdmin />} />
            <Route path="comercios" element={<ComerciosAdmin />} />
            <Route path="verificaciones" element={<VerificacionesAdmin />} />
          </Route>
          <Route path="/comercio/:type/:id" element={<RequireAuth><ComercioProfile /></RequireAuth>} />
          <Route path="/mi-perfil" element={<RequireAuth><MyProfile /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </AppErrorBoundary>
      </main>
      {user && <BottomNav />}
      {user && user.role !== 'admin' && user.role !== 'verificador' && <SideCart />}
      {user && <AiFloatingWidget />}
      <CookieConsent />
      <FeedbackHost />
    </div>
    </Suspense>
  );
}