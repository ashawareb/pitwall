import { describe, expect, it } from 'vitest';
import { CliArgsError, parseArgs } from '../src/args.js';

describe('parseArgs', () => {
  it('no arguments → all defaults false, no port/session', () => {
    expect(parseArgs([])).toEqual({
      all: false,
      noOpen: false,
      help: false,
      version: false,
    });
  });

  it('--all flips `all`', () => {
    expect(parseArgs(['--all'])).toMatchObject({ all: true });
  });

  it('--no-open flips `noOpen`', () => {
    expect(parseArgs(['--no-open'])).toMatchObject({ noOpen: true });
  });

  it('--help and -h both flip `help`', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('--version and -v both flip `version`', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
  });

  it('--session UUID captures the UUID', () => {
    expect(parseArgs(['--session', 'abc-123']).session).toBe('abc-123');
  });

  it('--session=UUID with equals syntax also works', () => {
    expect(parseArgs(['--session=abc-123']).session).toBe('abc-123');
  });

  it('--session without a value throws', () => {
    expect(() => parseArgs(['--session'])).toThrow(CliArgsError);
  });

  it('--session followed by another flag throws', () => {
    expect(() => parseArgs(['--session', '--all'])).toThrow(CliArgsError);
  });

  it('--port N parses the port as an integer', () => {
    expect(parseArgs(['--port', '4400']).port).toBe(4400);
  });

  it('--port=N with equals syntax works', () => {
    expect(parseArgs(['--port=4400']).port).toBe(4400);
  });

  it('--port 0 is rejected (reserved for the server-side kernel-assign path)', () => {
    expect(() => parseArgs(['--port', '0'])).toThrow(CliArgsError);
  });

  it('--port out-of-range throws', () => {
    expect(() => parseArgs(['--port', '70000'])).toThrow(CliArgsError);
    expect(() => parseArgs(['--port', '-1'])).toThrow(CliArgsError);
  });

  it('--port with non-numeric throws', () => {
    expect(() => parseArgs(['--port', 'abc'])).toThrow(CliArgsError);
  });

  it('combines --all --session UUID --port N --no-open', () => {
    expect(
      parseArgs(['--all', '--session', 'xyz', '--port', '5000', '--no-open']),
    ).toEqual({
      all: true,
      session: 'xyz',
      port: 5000,
      noOpen: true,
      help: false,
      version: false,
    });
  });

  it('unknown flags throw', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(CliArgsError);
  });
});
