import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRouter from './routes/auth';
import restaurantsRouter from './routes/restaurants';
import suppliersRouter from './routes/suppliers';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import ordersRouter from './routes/orders';
import inventoryRouter from './routes/inventory';
import invoicesRouter from './routes/invoices';
import reviewsRouter from './routes/reviews';
import accountingRouter from './routes/accounting';
import deliveriesRouter from './routes/deliveries';
import dashboardRouter from './routes/dashboard';
import aiRouter from './routes/ai';
import usersRouter from './routes/users';
import radarRouter from './routes/radar';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();
  const configuredOrigins = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        return cb(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'xupply-api' }));

  app.use('/api/auth', authRouter);
  app.use('/api/restaurants', restaurantsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/accounting', accountingRouter);
  app.use('/api/deliveries', deliveriesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/radar', radarRouter);

  // Endpoint de descarga directa del instalador APK para Android
  const serveApk = (_req: express.Request, res: express.Response) => {
    const candidates = [
      path.join(__dirname, '..', '..', '..', 'dist-apk', 'Xupply.apk'),
      path.join(__dirname, '..', '..', 'web', 'dist', 'Xupply.apk'),
      path.join(__dirname, '..', '..', 'web', 'public', 'Xupply.apk'),
      path.join(process.cwd(), 'dist-apk', 'Xupply.apk'),
      path.join(process.cwd(), 'app', 'web', 'dist', 'Xupply.apk'),
      path.join(process.cwd(), 'app', 'web', 'public', 'Xupply.apk'),
      path.join(process.cwd(), '..', 'dist-apk', 'Xupply.apk'),
      path.join(process.cwd(), '..', 'app', 'web', 'dist', 'Xupply.apk'),
      path.join(process.cwd(), '..', 'app', 'web', 'public', 'Xupply.apk'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="Xupply.apk"');
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        return res.sendFile(path.resolve(p));
      }
    }
    return res.status(404).json({ error: 'Instalador Xupply.apk no disponible actualmente' });
  };

  app.get('/download/apk', serveApk);
  app.get('/api/download/apk', serveApk);
  app.get('/Xupply.apk', serveApk);

  const distPath = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}