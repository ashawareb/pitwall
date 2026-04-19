/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vite's dev server listens on port 5173 by default. We do not pin a port —
// the server's CORS allowlist covers http://localhost:* so any free port
// Vite chooses will work. The proxy below is the only dev-time cross-origin
// hop we need: /api/* is forwarded to the Fastify server on 4317 so the
// client can fetch('/api/...') without a CORS preflight.
const API_PROXY_TARGET = 'http://localhost:4317';

// One file covers both Vite and Vitest so we do not carry a second config
// (spec 08's file list does not include vitest.config.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
