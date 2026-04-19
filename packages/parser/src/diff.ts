// Tiny LCS-based line diff for FileEdit addition/deletion counts.
// The rendering diff is done client-side in a later spec with a proper
// library; this file exists only to populate the integer counts.

function splitLines(s: string): string[] {
  if (s.length === 0) return [];
  const parts = s.split('\n');
  // Drop the final empty element when the input ended with '\n', so a
  // trailing newline is not treated as a phantom line (wc -l semantics).
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

export function countLineChanges(
  pre: string,
  post: string,
): { additions: number; deletions: number } {
  const a = splitLines(pre);
  const b = splitLines(post);
  const n = a.length;
  const m = b.length;

  if (n === 0) return { additions: m, deletions: 0 };
  if (m === 0) return { additions: 0, deletions: n };

  // Rolling-row LCS — we only need the length, not the reconstructed path.
  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    curr[0] = 0;
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
  }

  const lcs = prev[m]!;
  return { additions: m - lcs, deletions: n - lcs };
}
