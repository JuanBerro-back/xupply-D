"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
/**
 * Rate limiter en memoria, sin dependencias externas.
 * Suficiente para instancias únicas; en despliegues multi-instancia
 * debe sustituirse por un almacén compartido (Redis).
 */
function rateLimit({ windowMs, max, keyPrefix = '' }) {
    const buckets = new Map();
    const MAX_BUCKETS = 5000;
    function purgeExpired(now) {
        if (buckets.size < MAX_BUCKETS)
            return;
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= now)
                buckets.delete(key);
        }
    }
    return function rateLimitMiddleware(req, res, next) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        const now = Date.now();
        purgeExpired(now);
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        if (bucket.count > max) {
            const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
            });
        }
        return next();
    };
}
