import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const Catalog = lazy(() => import('./pages/Catalog'));

export const catalogRoutes: React.ReactElement[] = [
  <Route key="catalog" path="/catalogo" element={<RolesAllowed roles={['admin', 'gerente', 'empleado', 'proveedor_admin']}><Catalog /></RolesAllowed>} />,
];
