import { copyFile, cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(here, '..');
const repoRoot = resolve(cliRoot, '..', '..');
const clientDist = resolve(cliRoot, '..', 'client', 'dist');
const cliStatic = resolve(cliRoot, 'dist', 'static');

try {
  await stat(clientDist);
} catch {
  console.error(
    `copy-static: client dist not found at ${clientDist}. ` +
      `Run \`pnpm -F @pitwall/client build\` first, then retry the CLI build.`,
  );
  process.exit(1);
}

await rm(cliStatic, { recursive: true, force: true });
await mkdir(cliStatic, { recursive: true });
await cp(clientDist, cliStatic, { recursive: true });

// Stage the repo-root docs into the CLI package so npm pack / publish picks
// them up (npm auto-includes LICENSE but not CHANGELOG; README needs to live
// next to package.json for npmjs.com to render it). These copies are gitignored.
for (const filename of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
  await copyFile(resolve(repoRoot, filename), resolve(cliRoot, filename));
}
