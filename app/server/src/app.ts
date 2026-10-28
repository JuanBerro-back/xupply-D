import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import purchaseOrdersRouter from './routes/purchaseOrders';
import agentRouter from './routes/agent';
import xupaiRouter from './routes/xupai';
import adminRouter from './routes/admin';
import verificationRouter from './routes/verification';
import { ensureServerInitialized } from './lib/migrations';
import { query, resolveDatabaseUrl } from './config/db';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const configuredOrigins = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && origin !== '*');

  // Detrás de Vercel / Render / Caddy siempre hay un proxy: sin esto `req.ip`
  // devuelve la IP del proxy y el rate-limit (y la auditoría) quedan inútiles.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Cabeceras de seguridad. La CSP se define también aquí para despliegues
  // que no pasan por un borde con cabeceras propias (Render, VPS, Docker sin
  // Caddy). En Vercel/Caddy se refuerza en el borde.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Visor de documentos del back office: PDFs servidos como blob.
          frameSrc: ["'self'", 'blob:'],
          formAction: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    })
  );

  app.use(
    cors({
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        // Peticiones sin Origin (server-to-server, curl, apps nativas) se permiten.
        if (!origin) return cb(null, true);
        if (configuredOrigins.includes(origin)) return cb(null, true);
        // WebView de Capacitor (APK): el origen es https://localhost. No concede
        // acceso por sí solo; toda petición sigue exigiendo el Bearer token.
        const nativeOrigins = ['https://localhost', 'capacitor://localhost', 'http://localhost'];
        if (nativeOrigins.includes(origin)) return cb(null, true);
        // Fail-closed: sin lista blanca configurada, en producción NO se permite
        // ningún origen cruzado (antes se permitían todos).
        return cb(null, !isProduction);
      },
      credentials: true,
    })
  );
  // Límite explícito: evita peticiones gigantes que agoten memoria/CPU.
  // La carga de documentos de verificación usa su propio parser (6 MB) más
  // abajo, porque un PDF en base64 supera el límite general de 1 MB.
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (
      req.method === 'POST' &&
      /^\/api\/verification\/public\/[a-f0-9]{64}\/documents$/i.test(req.path)
    ) {
      return next();
    }
    return jsonParser(req, res, next);
  });

  // === 1. RUTAS DE DIAGNÓSTICO Y HEALTHCHECK (RESPUESTA INMEDIATA) ===
  const healthHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const resolved = resolveDatabaseUrl();
      if (process.env.VERCEL === '1' && !resolved.isConfigured) {
        // Mensaje genérico: no revelar nombres de variables ni detalles de infra.
        return res.status(503).json({ status: 'degraded', service: 'xupply-api' });
      }
      const testRes = await query("SELECT to_regclass('public.users') as has_users");
      return res.status(200).json({
        status: 'ok',
        service: 'xupply-api',
        db: 'connected',
        tables_ready: Boolean(testRes.rows[0]?.has_users),
      });
    } catch {
      return res.status(503).json({ status: 'degraded', service: 'xupply-api' });
    }
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // === 2. AUTO-INICIALIZACION DE BD PARA RUTAS DE NEGOCIO ===
  app.use(async (_req, _res, next) => {
    try {
      await ensureServerInitialized();
    } catch {
      // Error ya registrado en ensureServerInitialized
    }
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/verification', verificationRouter);
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
  app.use('/api/purchase-orders', purchaseOrdersRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/xupai', xupaiRouter);
  app.use('/api/admin', adminRouter);

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

const defaultApp = createApp();
export default defaultApp;