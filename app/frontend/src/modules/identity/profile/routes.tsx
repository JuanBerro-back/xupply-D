import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth } from '../../../shared/routing/guards';
const MyProfile = lazy(() => import('./pages/MyProfile'));

export const profileRoutes: React.ReactElement[] = [
  <Route key="profile" path="/mi-perfil" element={<RequireAuth><MyProfile /></RequireAuth>} />,
];
