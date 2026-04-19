// Deterministic time formatting. No Intl.RelativeTimeFormat, no date library —
// spec 09 rules out dependencies, and the cases here are narrow enough to
// implement directly. `now` is injectable so tests are not wall-clock bound.

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diff = now.getTime() - then;
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < MONTH_MS) return `${Math.floor(diff / WEEK_MS)}w ago`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo ago`;
  return new Date(then).toLocaleDateString();
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  if (ms < MINUTE_MS) return `${Math.floor(ms / SECOND_MS)}s`;
  if (ms < HOUR_MS) {
    const m = Math.floor(ms / MINUTE_MS);
    const s = Math.floor((ms % MINUTE_MS) / SECOND_MS);
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(ms / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// T+ timestamps in the Radio panel (spec 12). Distinct from formatDuration:
// sub-minute values keep one decimal of precision ("2.1s") because edits
// happen seconds apart and whole-second bucketing would collapse them, and
// ≥1min always includes the seconds component ("1m 0s", not "1m") so the
// display format is consistent across rows.
export function formatTPlus(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0s';
  if (ms < MINUTE_MS) {
    const tenths = Math.floor(ms / 100) / 10;
    return `${tenths.toFixed(1)}s`;
  }
  const m = Math.floor(ms / MINUTE_MS);
  const s = Math.floor((ms % MINUTE_MS) / SECOND_MS);
  return `${m}m ${s}s`;
}
