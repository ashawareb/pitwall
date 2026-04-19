import type { FastifyInstance } from 'fastify';
import pkg from '../../package.json' with { type: 'json' };

const VERSION = pkg.version;

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({
    ok: true,
    version: VERSION,
    apiVersion: 1 as const,
  }));
}
