import { lazy } from 'react';
import { Route } from 'react-router-dom';
const DownloadApp = lazy(() => import('./pages/DownloadApp'));

export const appDownloadRoutes: React.ReactElement[] = [
  <Route key="download" path="/descargar" element={<DownloadApp />} />,
];
