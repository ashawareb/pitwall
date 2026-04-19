import type { ApiErrorBody } from './types.js';

// Spec 08: fail loudly in dev if the server isn't running. Every fetch runs
// under an AbortController with a 5s timeout so a hung server does not
// leave UI hanging forever. Surfacing these errors in the UI is spec 09.

const TIMEOUT_MS = 5_000;

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiUnreachableError extends ApiError {
  constructor(path: string, cause?: unknown) {
    super(
      `Pitwall server is unreachable at ${path}. Is @pitwall/server running?`,
    );
    this.name = 'ApiUnreachableError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class ApiHttpError extends ApiError {
  readonly status: number;
  readonly code: string;

  constructor(path: string, status: number, code: string, detail: string) {
    super(`${path} → HTTP ${status} (${code}): ${detail}`);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  if (!('error' in value) || !('code' in value)) return false;
  return typeof value.error === 'string' && typeof value.code === 'string';
}

async function readErrorBody(
  res: Response,
): Promise<{ code: string; detail: string }> {
  try {
    const body: unknown = await res.json();
    if (isApiErrorBody(body)) {
      return { code: body.code, detail: body.error };
    }
  } catch {
    // Non-JSON body or parse failure — fall back to statusText below.
  }
  return { code: 'unknown', detail: res.statusText || 'No response body' };
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    // fetch() throws for DNS failure, ECONNREFUSED, aborts, and TLS errors.
    // All of them mean "server did not give us a response" — surface them
    // under one named error so spec 09's UI layer can branch on it.
    throw new ApiUnreachableError(path, err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const { code, detail } = await readErrorBody(res);
    throw new ApiHttpError(path, res.status, code, detail);
  }

  // reason: Response.json() is typed Promise<unknown> (lib.dom.d.ts). The
  // server contract is documented in docs/03-api-contract.md; trusting T
  // here is the single API boundary cast, not leaking `any` through code.
  const body = (await res.json()) as T;
  return body;
}
