import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../shared/routing/guards';
const Deliveries = lazy(() => import('./pages/Deliveries'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));

export const deliveriesRoutes: React.ReactElement[] = [
  <Route key="deliveries" path="/logistica" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin', 'domiciliario']}><Deliveries /></RolesAllowed>} />,
  <Route key="driver" path="/repartidor" element={<RolesAllowed roles={['domiciliario', 'admin']}><DriverDashboard /></RolesAllowed>} />,
];
