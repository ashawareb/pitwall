import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import type { Session } from '@pitwall/parser';
import { MtimeCache } from './cache.js';
import { buildCorsConfig } from './cors.js';
import type { SessionMetadata } from './fs/discover.js';
import { findFreePort } from './port.js';
import { ReplayCache } from './replay.js';
import { registerHealthRoute } from './routes/health.js';
import { registerProjectsRoute, type WarnState } from './routes/projects.js';
import { registerSessionDetailRoute } from './routes/session-detail.js';
import { registerSessionFileRoute } from './routes/session-file.js';
import { registerSessionReplayRoute } from './routes/session-replay.js';
import { registerSessionsRoute } from './routes/sessions.js';
import { registerStaticServe } from './static-serve.js';

const DEFAULT_START_PORT = 4317;
const MAX_PORT_ATTEMPTS = 20;
const CLOSE_TIMEOUT_MS = 5000;
const LOOPBACK_HOST = '127.0.0.1';

export interface StartServerOptions {
  // Passing 0 asks the kernel for a free port atomically (no TOCTOU window).
  // Omitted or a positive number walks from that port up to MAX_PORT_ATTEMPTS.
  port?: number;
  logger?: boolean;
  // Absolute path to a built client bundle. When set, the server serves
  // static assets at / with SPA fallback to index.html.
  staticRoot?: string;
}

export interface StartedServer {
  address: string;
  port: number;
  close: () => Promise<void>;
}

type LoggerOption =
  | false
  | {
      level: string;
      transport?: { target: string };
    };

function buildLoggerOption(userLogger: boolean | undefined): LoggerOption {
  if (userLogger === false) return false;
  const level = process.env.PITWALL_LOG_LEVEL ?? 'info';
  if (process.env.NODE_ENV === 'production') {
    return { level };
  }
  return {
    level,
    transport: { target: 'pino-pretty' },
  };
}

export async function closeWithTimeout(
  close: () => Promise<void>,
  timeoutMs: number = CLOSE_TIMEOUT_MS,
  onTimeout?: () => void,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      onTimeout?.();
      resolve();
    }, timeoutMs);
  });
  try {
    await Promise.race([close(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<StartedServer> {
  const requestedPort =
    options.port === 0
      ? 0
      : await findFreePort(
          options.port ?? DEFAULT_START_PORT,
          MAX_PORT_ATTEMPTS,
        );

  const app = Fastify({ logger: buildLoggerOption(options.logger) });

  await app.register(fastifyCors, buildCorsConfig());

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Pitwall-Api', '1');
  });

  // Two parser caches live on the server instance. metadataCache holds
  // SessionMetadata for the list endpoints (spec 06); sessionCache holds the
  // full parsed Session for the detail/file/replay endpoints (spec 07).
  // Separate caches so a mutation that invalidates one does not evict the
  // other, and so each stays in lockstep with its own consumer's mtime reads.
  const metadataCache = new MtimeCache<SessionMetadata>();
  const sessionCache = new MtimeCache<Session>();
  const replayCache = new ReplayCache();
  const warnState: WarnState = { warnedHomeMissing: false };

  await registerHealthRoute(app);
  await registerProjectsRoute(app, metadataCache, warnState);
  await registerSessionsRoute(app, metadataCache);
  await registerSessionDetailRoute(app, sessionCache);
  await registerSessionFileRoute(app, sessionCache);
  await registerSessionReplayRoute(app, sessionCache, replayCache);

  // Static serving must register AFTER API routes so the API radix entries
  // are matched before the static plugin's catch-all for GET /*.
  if (options.staticRoot !== undefined) {
    await registerStaticServe(app, options.staticRoot);
  }

  await app.listen({ port: requestedPort, host: LOOPBACK_HOST });

  const addr = app.server.address();
  const boundPort =
    typeof addr === 'object' && addr !== null ? addr.port : requestedPort;

  return {
    address: `http://${LOOPBACK_HOST}:${boundPort}`,
    port: boundPort,
    close: () =>
      closeWithTimeout(
        () => app.close(),
        CLOSE_TIMEOUT_MS,
        () =>
          app.log.warn(
            `server close timeout reached after ${CLOSE_TIMEOUT_MS}ms; forcing resolution`,
          ),
      ),
  };
}

// Boot a server and install SIGINT/SIGTERM handlers that close it cleanly
// before exiting. Shared by the dev entry point and the CLI bin so the
// signal wiring lives in one place.
export async function runServer(
  options: StartServerOptions = {},
): Promise<StartedServer> {
  const server = await startServer(options);

  async function shutdown(): Promise<void> {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  }

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  return server;
}
