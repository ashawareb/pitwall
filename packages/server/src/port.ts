import { createServer } from 'node:net';

export class NoFreePortError extends Error {
  public readonly startPort: number;
  public readonly maxAttempts: number;

  constructor(startPort: number, maxAttempts: number) {
    super(
      `No free port found in range ${startPort}..${startPort + maxAttempts - 1}`,
    );
    this.name = 'NoFreePortError';
    this.startPort = startPort;
    this.maxAttempts = maxAttempts;
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, '127.0.0.1');
  });
}

export async function findFreePort(
  startPort: number,
  maxAttempts = 20,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new NoFreePortError(startPort, maxAttempts);
}
