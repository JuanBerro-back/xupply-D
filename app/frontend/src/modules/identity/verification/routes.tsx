import { lazy } from 'react';
import { Route } from 'react-router-dom';
const VerificationStatus = lazy(() => import('./pages/VerificationStatus'));

export const verificationRoutes: React.ReactElement[] = [
  <Route key="verification" path="/verificacion/:token" element={<VerificationStatus />} />,
];
