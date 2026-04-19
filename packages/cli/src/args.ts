export interface CliArgs {
  all: boolean;
  session?: string;
  port?: number;
  noOpen: boolean;
  help: boolean;
  version: boolean;
}

export class CliArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgsError';
  }
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    all: false,
    noOpen: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    switch (token) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--no-open':
        args.noOpen = true;
        break;
      case '--session': {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) {
          throw new CliArgsError('--session requires a session UUID argument');
        }
        args.session = value;
        i++;
        break;
      }
      case '--port': {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) {
          throw new CliArgsError('--port requires a port number argument');
        }
        const port = Number.parseInt(value, 10);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new CliArgsError(
            `--port must be an integer between 1 and 65535 (got "${value}")`,
          );
        }
        args.port = port;
        i++;
        break;
      }
      default:
        if (token.startsWith('--session=')) {
          args.session = token.slice('--session='.length);
        } else if (token.startsWith('--port=')) {
          const raw = token.slice('--port='.length);
          const port = Number.parseInt(raw, 10);
          if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new CliArgsError(
              `--port must be an integer between 1 and 65535 (got "${raw}")`,
            );
          }
          args.port = port;
        } else {
          throw new CliArgsError(`Unknown argument: ${token}`);
        }
    }
  }

  return args;
}
