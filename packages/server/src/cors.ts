import type { FastifyCorsOptions } from '@fastify/cors';

export function buildCorsConfig(): FastifyCorsOptions {
  return {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      try {
        const { hostname } = new URL(origin);
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          cb(null, true);
          return;
        }
      } catch {
        // malformed origin — fall through to reject
      }
      cb(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  };
}
