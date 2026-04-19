import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, type StartedServer } from '../src/index.js';

describe('static serving with staticRoot', () => {
  let server: StartedServer | undefined;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = mkdtempSync(join(tmpdir(), 'pitwall-static-'));
    await writeFile(
      join(staticRoot, 'index.html'),
      '<!doctype html><title>pitwall</title>',
      'utf8',
    );
    await writeFile(
      join(staticRoot, 'asset.js'),
      'console.log("hi")',
      'utf8',
    );
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
    rmSync(staticRoot, { recursive: true, force: true });
  });

  it('GET / serves index.html', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/html/);
    const body = await response.text();
    expect(body).toContain('<title>pitwall</title>');
  });

  it('GET /asset.js serves the static asset', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/asset.js`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('console.log("hi")');
  });

  it('GET /some/client/route falls back to index.html (SPA)', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/session/abc/edit/42`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/html/);
    const body = await response.text();
    expect(body).toContain('<title>pitwall</title>');
  });

  it('GET /api/health still returns JSON, not HTML', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/api/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/json/);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('GET /api/bogus returns JSON 404, not HTML SPA fallback', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/api/bogus`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/json/);
  });

  it('POST /something returns JSON 404, not HTML', async () => {
    server = await startServer({ port: 0, logger: false, staticRoot });
    const response = await fetch(`${server.address}/something`, {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/json/);
  });

  it('without staticRoot, no SPA fallback — unknown GETs return JSON 404', async () => {
    server = await startServer({ port: 0, logger: false });
    const response = await fetch(`${server.address}/session/abc`);
    expect(response.status).toBe(404);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toMatch(/json/);
  });
});
