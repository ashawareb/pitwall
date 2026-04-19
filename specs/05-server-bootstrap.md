# Spec 05 · server-bootstrap

## Purpose

Stand up the `@pitwall/server` package with a Fastify HTTP server,
port discovery, CORS, and graceful shutdown. No endpoints yet beyond
`/api/health`.

## Scope

- Create `packages/server` with Fastify, pino (logger), and `@pitwall/parser`
  as workspace dependency.
- Implement port discovery: try 4317 first, walk up until a free port
  is found, max 20 attempts.
- Implement CORS allowing `http://localhost:*` only.
- Implement graceful shutdown on SIGINT/SIGTERM.
- Implement `GET /api/health`.
- Add an `X-Pitwall-Api: 1` header to every response (see
  `docs/03-api-contract.md`).
- Expose a `startServer({ port?, logger? })` function that returns
  a `{ address, port, close }` object.

## Dependencies

Spec 04 must be complete (parser fully usable).

## Acceptance criteria

- `pnpm -F @pitwall/server build`, `typecheck`, `lint`, `test` all
  pass.
- Running `pnpm -F @pitwall/server dev` starts the server on 4317 (or
  the first free port above).
- `curl localhost:<port>/api/health` returns
  `{ ok: true, version: "0.1.0", apiVersion: 1 }`.
- Every response includes `X-Pitwall-Api: 1`.
- Ctrl-C in the `dev` terminal triggers a clean shutdown within 1s,
  not a force-kill.
- Port discovery:
  - If 4317 is taken, try 4318, then 4319, etc.
  - After 20 attempts, throw `NoFreePortError` with the range tried.
- CORS:
  - `OPTIONS` preflight responds with allowed methods and headers.
  - `Origin: http://localhost:5173` is accepted.
  - `Origin: https://evil.com` is rejected.
- At least 4 integration tests hitting a real Fastify instance.

## Files to create

- `packages/server/package.json`
- `packages/server/tsconfig.json`
- `packages/server/tsup.config.ts`
- `packages/server/vitest.config.ts`
- `packages/server/src/index.ts`
- `packages/server/src/server.ts`
- `packages/server/src/port.ts`
- `packages/server/src/cors.ts`
- `packages/server/src/routes/health.ts`
- `packages/server/test/server.test.ts`
- `packages/server/test/port.test.ts`

## Notes

- Use Fastify 4+. Do not use Express.
- Log format is pino-pretty in dev and JSON in production.
- Logger level defaults to `info`, overridable via `PITWALL_LOG_LEVEL`.

## Do not

- Do not add session endpoints. Those are specs 06 and 07.
- Do not serve static client files yet. Spec 15 handles bundling.
- Do not add authentication. Pitwall is local-only.
- Do not persist anything to disk outside logs.
