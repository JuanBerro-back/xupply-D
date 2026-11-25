import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../../shared/routing/guards';
const PaymentResult = lazy(() => import('./pages/PaymentResult'));

export const paymentsRoutes: React.ReactElement[] = [
  <Route key="payment-result" path="/pago/resultado" element={<RequireAuth><PaymentResult /></RequireAuth>} />,
];
