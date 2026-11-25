import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const Plans = lazy(() => import('./pages/Plans'));

export const plansRoutes: React.ReactElement[] = [
  <Route key="plans" path="/planes" element={<RolesAllowed roles={['admin', 'gerente']}><Plans /></RolesAllowed>} />,
];
