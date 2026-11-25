import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const Radar = lazy(() => import('./pages/Radar'));

export const radarRoutes: React.ReactElement[] = [
  <Route key="radar" path="/radar" element={<RolesAllowed roles={['admin', 'gerente', 'empleado', 'proveedor_admin']}><Radar /></RolesAllowed>} />,
];
