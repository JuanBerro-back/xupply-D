import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Ventana de tiempo en milisegundos. */
  windowMs: number;
  /** Máximo de solicitudes permitidas por ventana y por clave. */
  max: number;
  /** Prefijo para separar cubos por tipo de endpoint. */
  keyPrefix?: string;
}

/**
 * Rate limiter en memoria, sin dependencias externas.
 * Suficiente para instancias únicas; en despliegues multi-instancia
 * debe sustituirse por un almacén compartido (Redis).
 */
export function rateLimit({ windowMs, max, keyPrefix = '' }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const MAX_BUCKETS = 5000;

  function purgeExpired(now: number) {
    if (buckets.size < MAX_BUCKETS) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
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
