"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = __importDefault(require("./routes/auth"));
const restaurants_1 = __importDefault(require("./routes/restaurants"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const products_1 = __importDefault(require("./routes/products"));
const categories_1 = __importDefault(require("./routes/categories"));
const orders_1 = __importDefault(require("./routes/orders"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const accounting_1 = __importDefault(require("./routes/accounting"));
const deliveries_1 = __importDefault(require("./routes/deliveries"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const ai_1 = __importDefault(require("./routes/ai"));
const users_1 = __importDefault(require("./routes/users"));
const radar_1 = __importDefault(require("./routes/radar"));
const purchaseOrders_1 = __importDefault(require("./routes/purchaseOrders"));
const agent_1 = __importDefault(require("./routes/agent"));
const xupai_1 = __importDefault(require("./routes/xupai"));
const admin_1 = __importDefault(require("./routes/admin"));
const migrations_1 = require("./lib/migrations");
const db_1 = require("./config/db");
const error_1 = require("./middleware/error");
function createApp() {
    const app = (0, express_1.default)();
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
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
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
    }));
    app.use((0, cors_1.default)({
        origin: (origin, cb) => {
            // Peticiones sin Origin (server-to-server, curl, apps nativas) se permiten.
            if (!origin)
                return cb(null, true);
            if (configuredOrigins.includes(origin))
                return cb(null, true);
            // Fail-closed: sin lista blanca configurada, en producción NO se permite
            // ningún origen cruzado (antes se permitían todos).
            return cb(null, !isProduction);
        },
        credentials: true,
    }));
    // Límite explícito: evita peticiones gigantes que agoten memoria/CPU.
    app.use(express_1.default.json({ limit: '1mb' }));
    // === 1. RUTAS DE DIAGNÓSTICO Y HEALTHCHECK (RESPUESTA INMEDIATA) ===
    const healthHandler = async (_req, res) => {
        try {
            const resolved = (0, db_1.resolveDatabaseUrl)();
            if (process.env.VERCEL === '1' && !resolved.isConfigured) {
                // Mensaje genérico: no revelar nombres de variables ni detalles de infra.
                return res.status(503).json({ status: 'degraded', service: 'xupply-api' });
            }
            const testRes = await (0, db_1.query)("SELECT to_regclass('public.users') as has_users");
            return res.status(200).json({
                status: 'ok',
                service: 'xupply-api',
                db: 'connected',
                tables_ready: Boolean(testRes.rows[0]?.has_users),
            });
        }
        catch {
            return res.status(503).json({ status: 'degraded', service: 'xupply-api' });
        }
    };
    app.get('/health', healthHandler);
    app.get('/api/health', healthHandler);
    // === 2. AUTO-INICIALIZACION DE BD PARA RUTAS DE NEGOCIO ===
    app.use(async (_req, _res, next) => {
        try {
            await (0, migrations_1.ensureServerInitialized)();
        }
        catch {
            // Error ya registrado en ensureServerInitialized
        }
        next();
    });
    app.use('/api/auth', auth_1.default);
    app.use('/api/restaurants', restaurants_1.default);
    app.use('/api/suppliers', suppliers_1.default);
    app.use('/api/products', products_1.default);
    app.use('/api/categories', categories_1.default);
    app.use('/api/orders', orders_1.default);
    app.use('/api/inventory', inventory_1.default);
    app.use('/api/invoices', invoices_1.default);
    app.use('/api/reviews', reviews_1.default);
    app.use('/api/accounting', accounting_1.default);
    app.use('/api/deliveries', deliveries_1.default);
    app.use('/api/dashboard', dashboard_1.default);
    app.use('/api/ai', ai_1.default);
    app.use('/api/users', users_1.default);
    app.use('/api/radar', radar_1.default);
    app.use('/api/purchase-orders', purchaseOrders_1.default);
    app.use('/api/agent', agent_1.default);
    app.use('/api/xupai', xupai_1.default);
    app.use('/api/admin', admin_1.default);
    // Endpoint de descarga directa del instalador APK para Android
    const serveApk = (_req, res) => {
        const candidates = [
            path_1.default.join(__dirname, '..', '..', '..', 'dist-apk', 'Xupply.apk'),
            path_1.default.join(__dirname, '..', '..', 'web', 'dist', 'Xupply.apk'),
            path_1.default.join(__dirname, '..', '..', 'web', 'public', 'Xupply.apk'),
            path_1.default.join(process.cwd(), 'dist-apk', 'Xupply.apk'),
            path_1.default.join(process.cwd(), 'app', 'web', 'dist', 'Xupply.apk'),
            path_1.default.join(process.cwd(), 'app', 'web', 'public', 'Xupply.apk'),
            path_1.default.join(process.cwd(), '..', 'dist-apk', 'Xupply.apk'),
            path_1.default.join(process.cwd(), '..', 'app', 'web', 'dist', 'Xupply.apk'),
            path_1.default.join(process.cwd(), '..', 'app', 'web', 'public', 'Xupply.apk'),
        ];
        for (const p of candidates) {
            if (fs_1.default.existsSync(p)) {
                res.setHeader('Content-Disposition', 'attachment; filename="Xupply.apk"');
                res.setHeader('Content-Type', 'application/vnd.android.package-archive');
                return res.sendFile(path_1.default.resolve(p));
            }
        }
        return res.status(404).json({ error: 'Instalador Xupply.apk no disponible actualmente' });
    };
    app.get('/download/apk', serveApk);
    app.get('/api/download/apk', serveApk);
    app.get('/Xupply.apk', serveApk);
    const distPath = path_1.default.join(__dirname, '..', '..', 'web', 'dist');
    if (fs_1.default.existsSync(path_1.default.join(distPath, 'index.html'))) {
        app.use(express_1.default.static(distPath));
        app.get('*', (_req, res) => res.sendFile(path_1.default.join(distPath, 'index.html')));
    }
    app.use(error_1.notFound);
    app.use(error_1.errorHandler);
    return app;
}
const defaultApp = createApp();
exports.default = defaultApp;
