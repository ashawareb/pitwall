import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server as NetServer } from 'node:net';
import {
  closeWithTimeout,
  startServer,
  type StartedServer,
} from '../src/index.js';

describe('startServer', () => {
  let server: StartedServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it('GET /api/health returns ok: true with version and apiVersion', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, version: '0.1.0', apiVersion: 1 });
  });

  it('every response includes X-Pitwall-Api: 1 header', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`);
    expect(response.headers.get('x-pitwall-api')).toBe('1');
  });

  it('CORS preflight from http://localhost:5173 is accepted', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    );
  });

  it('CORS preflight from http://127.0.0.1:5173 is accepted', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://127.0.0.1:5173',
    );
  });

  it('request without Origin header is served (same-origin / curl)', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('CORS rejects Origin: https://evil.com (200 body, no ACAO header)', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`, {
      headers: { Origin: 'https://evil.com' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('walks to the next free port when start port is taken', async () => {
    const blocker: NetServer = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(4317, '127.0.0.1', () => resolve());
    });
    try {
      server = await startServer({ logger: false });
      expect(server.port).toBeGreaterThan(4317);
      expect(server.port).toBe(4318);
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('close() shuts the server down cleanly', async () => {
    server = await startServer({ port: 0, logger: false });
    const addr = server.address;
    await server.close();
    server = undefined;
    await expect(fetch(`${addr}/api/health`)).rejects.toThrow();
  });
});

describe('closeWithTimeout', () => {
  it('resolves within the timeout even if inner close hangs', async () => {
    const start = Date.now();
    let timedOut = false;
    await closeWithTimeout(
      () => new Promise<void>(() => {}),
      50,
      () => {
        timedOut = true;
      },
    );
    const elapsed = Date.now() - start;
    expect(timedOut).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(500);
  });
});
