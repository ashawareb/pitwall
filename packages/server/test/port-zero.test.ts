import { afterEach, describe, expect, it } from 'vitest';
import { startServer, type StartedServer } from '../src/index.js';

describe('startServer({ port: 0 })', () => {
  let server: StartedServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it('binds a kernel-assigned port and reports it back', async () => {
    server = await startServer({ port: 0, logger: false });
    expect(server.port).toBeGreaterThan(0);
    expect(server.port).not.toBe(4317);
    expect(server.address).toBe(`http://127.0.0.1:${server.port}`);
  });

  it('two port:0 servers get distinct ports simultaneously', async () => {
    const a = await startServer({ port: 0, logger: false });
    const b = await startServer({ port: 0, logger: false });
    try {
      expect(a.port).not.toBe(b.port);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it('serves /api/health on the kernel-assigned port', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
