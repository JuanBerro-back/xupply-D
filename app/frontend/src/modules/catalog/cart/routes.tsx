import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../../shared/routing/guards';
const CartPage = lazy(() => import('./pages/CartPage'));

export const cartRoutes: React.ReactElement[] = [
  <Route key="cart" path="/carrito" element={<RolesAllowed roles={['gerente', 'empleado']}><CartPage /></RolesAllowed>} />,
];
