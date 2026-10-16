"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
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
    const configuredOrigins = (process.env.CLIENT_ORIGIN ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.use((0, cors_1.default)({
        origin: (origin, cb) => {
            // Permitir peticiones sin Origin (server-to-server, curl) y, en desarrollo,
            // cuando no hay CLIENT_ORIGIN configurado. En producción se exige la lista blanca.
            if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
                return cb(null, true);
            }
            return cb(null, false);
        },
        credentials: true,
    }));
    app.use(express_1.default.json());
    // === 1. RUTAS DE DIAGNÓSTICO Y HEALTHCHECK (RESPUESTA INMEDIATA) ===
    const healthHandler = async (_req, res) => {
        try {
            const resolved = (0, db_1.resolveDatabaseUrl)();
            if (process.env.VERCEL === '1' && !resolved.isConfigured) {
                return res.status(200).json({
                    status: 'ok',
                    service: 'xupply-api',
                    db: 'missing_env',
                    message: 'DATABASE_URL (o POSTGRES_URL) no está configurada en Vercel Settings -> Environment Variables.',
                });
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
            return res.status(200).json({
                status: 'ok',
                service: 'xupply-api',
                db: 'error',
            });
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
