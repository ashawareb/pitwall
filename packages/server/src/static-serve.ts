import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

// SPA fallback: any GET that isn't /api/* and doesn't match a real file
// resolves to index.html so client-side routing (react-router) can take over.
// Non-GETs and /api/* 404s return JSON to match the API contract.

export async function registerStaticServe(
  app: FastifyInstance,
  staticRoot: string,
): Promise<void> {
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: '/',
  });

  app.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? '';
    if (request.method === 'GET' && !url.startsWith('/api/')) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found', code: 'not_found' });
  });
}
