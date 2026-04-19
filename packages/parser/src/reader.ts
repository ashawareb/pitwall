import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { ParseError, SchemaError } from './errors.js';
import { parseSessionRecord, type SessionRecord } from './schema.js';

const BOM = '\uFEFF';

export async function* readSessionRecords(
  filepath: string,
): AsyncGenerator<SessionRecord, void, void> {
  const stream = createReadStream(filepath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  let bomChecked = false;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      let line = rawLine;
      if (!bomChecked) {
        bomChecked = true;
        if (line.startsWith(BOM)) line = line.slice(BOM.length);
      }
      if (line.trim() === '') continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (cause) {
        throw new ParseError(
          `Invalid JSON at line ${lineNumber} of ${filepath}`,
          { lineNumber, filepath, cause },
        );
      }

      const result = parseSessionRecord(parsed);
      if (!result.success) {
        throw new SchemaError(
          `Schema validation failed at line ${lineNumber} of ${filepath}`,
          { lineNumber, filepath, issues: result.error.issues },
        );
      }
      yield result.data;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}
