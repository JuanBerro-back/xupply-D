import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const Inventory = lazy(() => import('./pages/Inventory'));

export const inventoryRoutes: React.ReactElement[] = [
  <Route key="inventory" path="/inventario" element={<RolesAllowed roles={['gerente', 'empleado']}><Inventory /></RolesAllowed>} />,
];
