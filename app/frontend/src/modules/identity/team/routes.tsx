import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const TeamManagement = lazy(() => import('./pages/TeamManagement'));

export const teamRoutes: React.ReactElement[] = [
  <Route key="team" path="/equipo" element={<RolesAllowed roles={['gerente', 'proveedor_admin']}><TeamManagement /></RolesAllowed>} />,
];
