import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const Invoices = lazy(() => import('./pages/Invoices'));
const Accounting = lazy(() => import('./pages/Accounting'));

export const invoicingRoutes: React.ReactElement[] = [
  <Route key="invoices" path="/facturacion" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><Invoices /></RolesAllowed>} />,
  <Route key="accounting" path="/contabilidad" element={<RolesAllowed roles={['admin', 'gerente', 'proveedor_admin']}><Accounting /></RolesAllowed>} />,
];
