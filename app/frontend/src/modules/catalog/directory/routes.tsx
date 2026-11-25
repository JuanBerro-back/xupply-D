import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth, RolesAllowed } from '../../../shared/routing/guards';
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PosiblesClientes = lazy(() => import('./pages/PosiblesClientes'));
const ComercioProfile = lazy(() => import('./pages/ComercioProfile'));

export const directoryRoutes: React.ReactElement[] = [
  <Route key="suppliers" path="/proveedores" element={<RequireAuth><Suppliers /></RequireAuth>} />,
  <Route key="clients" path="/clientes" element={<RolesAllowed roles={['proveedor_admin', 'admin']}><PosiblesClientes /></RolesAllowed>} />,
  <Route key="commerce-profile" path="/comercio/:type/:id" element={<RequireAuth><ComercioProfile /></RequireAuth>} />,
];
