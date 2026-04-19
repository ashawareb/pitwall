import { describe, expect, it } from 'vitest';
import { createServer, type Server as NetServer } from 'node:net';
import { findFreePort, NoFreePortError } from '../src/port.js';

describe('findFreePort', () => {
  it('throws NoFreePortError when all ports in the range are taken', async () => {
    const startPort = 50050;
    const attempts = 3;
    const blockers: NetServer[] = [];
    try {
      for (let i = 0; i < attempts; i++) {
        const s = createServer();
        await new Promise<void>((resolve, reject) => {
          s.once('error', reject);
          s.listen(startPort + i, '127.0.0.1', () => resolve());
        });
        blockers.push(s);
      }
      await expect(findFreePort(startPort, attempts)).rejects.toBeInstanceOf(
        NoFreePortError,
      );
    } finally {
      for (const s of blockers) {
        await new Promise<void>((resolve) => s.close(() => resolve()));
      }
    }
  });
});
