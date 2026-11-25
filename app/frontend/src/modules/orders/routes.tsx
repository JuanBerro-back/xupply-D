import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../shared/routing/guards';
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));

export const ordersRoutes: React.ReactElement[] = [
  <Route key="orders" path="/pedidos" element={<RequireAuth><Orders /></RequireAuth>} />,
  <Route key="order-detail" path="/pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />,
];
