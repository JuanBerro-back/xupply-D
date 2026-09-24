import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useNotifications } from './context/NotificationContext';
import Navbar from './components/Navbar';
import SideCart from './components/SideCart';
import Toasts from './components/Toasts';
import AiFloatingWidget from './components/AiFloatingWidget';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import CartPage from './pages/CartPage';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import Suppliers from './pages/Suppliers';
import Accounting from './pages/Accounting';
import Deliveries from './pages/Deliveries';
import Plans from './pages/Plans';
import AiAssistant from './pages/AiAssistant';
import TeamManagement from './pages/TeamManagement';
import Radar from './pages/Radar';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RolesAllowed({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  const { items } = useNotifications();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0b1120] dark:text-slate-100 antialiased transition-colors duration-300">
      {user && <Navbar />}
      <main className={user ? 'mx-auto max-w-7xl px-4 py-6 pb-24 lg:pb-6' : ''}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/catalogo" element={<RequireAuth><Catalog /></RequireAuth>} />
          <Route path="/carrito" element={<RequireAuth><CartPage /></RequireAuth>} />
          <Route path="/pedidos" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/inventario" element={<RolesAllowed roles={['admin', 'gerente', 'empleado']}><Inventory /></RolesAllowed>} />
          <Route path="/radar" element={<RolesAllowed roles={['admin', 'gerente', 'empleado', 'proveedor_admin']}><Radar /></RolesAllowed>} />
          <Route path="/facturacion" element={<RolesAllowed roles={['admin', 'gerente']}><Invoices /></RolesAllowed>} />
          <Route path="/contabilidad" element={<RolesAllowed roles={['admin', 'gerente']}><Accounting /></RolesAllowed>} />
          <Route path="/proveedores" element={<RequireAuth><Suppliers /></RequireAuth>} />
          <Route path="/logistica" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin', 'domiciliario']}><Deliveries /></RolesAllowed>} />
          <Route path="/planes" element={<RequireAuth><Plans /></RequireAuth>} />
          <Route path="/xupply-ia" element={<RequireAuth><AiAssistant /></RequireAuth>} />
          <Route path="/equipo" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><TeamManagement /></RolesAllowed>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {items.length > 0 && <Toasts />}
      <SideCart />
      {user && <AiFloatingWidget />}
    </div>
  );
}