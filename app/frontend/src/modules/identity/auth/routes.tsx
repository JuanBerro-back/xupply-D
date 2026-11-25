import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export const authRoutes: React.ReactElement[] = [
  <Route key="login" path="/login" element={<GuestOnly><Login /></GuestOnly>} />,
  <Route key="register" path="/register" element={<GuestOnly><Register /></GuestOnly>} />,
];
