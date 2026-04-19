import { runServer } from '@pitwall/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliArgsError, parseArgs } from './args.js';
import { formatBanner } from './banner.js';
import { helpText, versionText } from './help.js';
import { openBrowser } from './open-browser.js';
import { projectHash } from './project-hash.js';
import { buildUrl } from './url.js';

const binDir = dirname(fileURLToPath(import.meta.url));
const staticRoot = join(binDir, 'static');
const pkgJson = JSON.parse(
  readFileSync(join(binDir, '..', 'package.json'), 'utf8'),
) as { version: string };
const version = pkgJson.version;

async function main(argv: string[]): Promise<void> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof CliArgsError) {
      process.stderr.write(`${error.message}\n\n`);
      process.stderr.write(helpText(version));
      process.exit(2);
    }
    throw error;
  }

  if (args.help) {
    process.stdout.write(helpText(version));
    return;
  }
  if (args.version) {
    process.stdout.write(versionText(version));
    return;
  }

  const cwd = process.cwd();
  const server = await runServer({
    port: args.port,
    staticRoot,
  });

  const url = buildUrl({
    baseUrl: server.address,
    all: args.all,
    session: args.session,
    projectHash: projectHash(cwd),
  });

  process.stdout.write(
    formatBanner({ version, cwd, url: server.address }),
  );

  if (!args.noOpen) {
    try {
      await openBrowser(url);
    } catch {
      process.stderr.write(
        `Could not auto-open the browser. Navigate manually to:\n  ${url}\n`,
      );
    }
  }
}

await main(process.argv.slice(2));
