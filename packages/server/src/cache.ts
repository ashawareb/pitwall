import { stat } from 'node:fs/promises';

type Entry<T> =
  | { mtimeMs: number; status: 'ok'; value: T }
  | { mtimeMs: number; status: 'error'; error: unknown };

// mtime-keyed memo for per-file parsed values. Caches errors alongside values
// so a malformed JSONL is not re-parsed (and re-logged) on every request until
// it actually changes on disk. Keyed by absolute filepath; each server
// instance owns one cache so tests get isolation automatically.
//
// Correctness invariant: this assumes every content-changing write to the
// cached file advances the filesystem mtime. Under normal writes (fs.writeFile,
// appends, editor saves) every OS we support bumps mtime to "now", so a real
// content change is always observable as a new mtimeMs. A tool that rewrites
// the file while forcibly restoring the old mtime (utimes) can defeat this —
// the cache will serve stale data until the next mtime-advancing write. That
// is intentional for cache-hit semantics; it is the caller's responsibility
// not to tamper with timestamps in production.
export class MtimeCache<T> {
  private readonly map: Map<string, Entry<T>> = new Map();

  async getOrCompute(
    filepath: string,
    compute: (filepath: string) => Promise<T>,
  ): Promise<T> {
    const st = await stat(filepath);
    const mtimeMs = st.mtimeMs;
    const hit = this.map.get(filepath);
    if (hit && hit.mtimeMs === mtimeMs) {
      if (hit.status === 'ok') return hit.value;
      throw hit.error;
    }
    try {
      const value = await compute(filepath);
      this.map.set(filepath, { mtimeMs, status: 'ok', value });
      return value;
    } catch (err) {
      this.map.set(filepath, { mtimeMs, status: 'error', error: err });
      throw err;
    }
  }
}
