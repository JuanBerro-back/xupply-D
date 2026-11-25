import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RolesAllowed } from '../../shared/routing/guards';
const AiAssistant = lazy(() => import('./pages/AiAssistant'));

export const aiRoutes: React.ReactElement[] = [
  <Route key="ai" path="/xupply-ia" element={<RolesAllowed roles={['gerente', 'proveedor_admin']}><AiAssistant /></RolesAllowed>} />,
];
