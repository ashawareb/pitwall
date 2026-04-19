// Shortest-unique-suffix algorithm for displaying paths in the left rail.
// Non-colliding basenames stay bare; colliding basenames grow to the shortest
// path-segment suffix that makes each entry distinct within its collision
// group. Example — inputs ["app/models/user_tag.rb",
// "app/serializers/user_tag.rb"] yield ["models/user_tag.rb",
// "serializers/user_tag.rb"]. Caller passes the full set (Timeline's
// chronological list, or SectorsView's same global list); identical input
// produces identical labels so both rails agree per edit.
export function disambiguateBasenames(paths: string[]): string[] {
  const segments = paths.map((p) => p.split('/').filter((s) => s.length > 0));
  const basenames = segments.map((segs) => {
    const last = segs[segs.length - 1];
    return last ?? '';
  });
  const groups = new Map<string, number[]>();
  basenames.forEach((name, i) => {
    const arr = groups.get(name) ?? [];
    arr.push(i);
    groups.set(name, arr);
  });
  const labels = basenames.slice();
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const groupSegs = indexes.map((i) => segments[i] ?? []);
    const maxSegs = Math.max(...groupSegs.map((s) => s.length));
    for (let k = 2; k <= maxSegs; k++) {
      const suffixes = groupSegs.map((segs) => segs.slice(-k).join('/'));
      const unique = new Set(suffixes).size === suffixes.length;
      if (unique || k === maxSegs) {
        indexes.forEach((idx, j) => {
          const s = suffixes[j];
          if (s !== undefined) labels[idx] = s;
        });
        break;
      }
    }
  }
  return labels;
}
