import { describe, it, expect } from 'vitest';
import { pickTriggeringSentence } from '../src/intent.js';
import { tokenizeSentences } from '../src/tokenizer.js';

describe('pickTriggeringSentence', () => {
  it('returns null for an empty sentences array', () => {
    const result = pickTriggeringSentence(
      [],
      'lib/foo.ts',
      'Write',
      'export const foo = 1;',
      { file_path: '/abs/lib/foo.ts', content: 'export const foo = 1;' },
    );
    expect(result).toBeNull();
  });

  it('picks the sentence whose tokens overlap the file path', () => {
    const sentences = tokenizeSentences(
      'Hello there. Add it to lib/greet.ts please.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'lib/greet.ts',
      'Write',
      "export const greet = () => 'hi';",
      {
        file_path: '/abs/lib/greet.ts',
        content: "export const greet = () => 'hi';",
      },
    );
    expect(result?.text).toBe('Add it to lib/greet.ts please.');
  });

  it('highest score wins among multiple positive matches', () => {
    // Sentence A shares {lib} = 1 point. Sentence B shares
    // {lib, greet, ts} = 3 points. B must win — locks the "bestScore
    // wins" invariant beyond the tie case covered below.
    const sentences = tokenizeSentences(
      'Consider the lib directory. Then add lib/greet.ts.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'lib/greet.ts',
      'Write',
      "export const greet = () => 'hi';",
      {
        file_path: '/abs/lib/greet.ts',
        content: "export const greet = () => 'hi';",
      },
    );
    expect(result?.text).toBe('Then add lib/greet.ts.');
  });

  it('breaks ties by picking the earlier sentence', () => {
    const sentences = tokenizeSentences(
      'Update the foo module. Also update the foo module.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'lib/foo.ts',
      'Edit',
      'foo bar',
      {
        file_path: '/abs/lib/foo.ts',
        old_string: 'x',
        new_string: 'foo bar',
      },
    );
    expect(result?.index).toBe(0);
    expect(result?.text).toBe('Update the foo module.');
  });

  it('returns null when no sentence shares any token with the edit', () => {
    const sentences = tokenizeSentences('Hello world. How are you today?');
    const result = pickTriggeringSentence(
      sentences,
      'lib/greet.ts',
      'Write',
      'export const greet = 1;',
      {
        file_path: '/abs/lib/greet.ts',
        content: 'export const greet = 1;',
      },
    );
    expect(result).toBeNull();
  });

  it('uses a mixed-case identifier extracted from the snippet as a keyword', () => {
    const sentences = tokenizeSentences(
      'Nothing here. Make sure UserController is set.',
    );
    // Path has no usable tokens; only the UserController keyword from
    // the snippet can tie the second sentence to the edit.
    const result = pickTriggeringSentence(
      sentences,
      'x',
      'Edit',
      'class UserController\n  def index\n  end\nend',
      { file_path: '/abs/x', old_string: 'x', new_string: 'y' },
    );
    expect(result?.text).toBe('Make sure UserController is set.');
  });

  it('uses a quoted-string keyword extracted from the snippet', () => {
    const sentences = tokenizeSentences(
      'Replace with something. Use greeting "hello".',
    );
    const result = pickTriggeringSentence(
      sentences,
      'z',
      'Edit',
      "const g = 'hello';",
      {
        file_path: '/abs/z',
        old_string: 'x',
        new_string: "const g = 'hello';",
      },
    );
    expect(result?.text).toBe('Use greeting "hello".');
  });

  it('uses a word.word file-extension token from the snippet', () => {
    const sentences = tokenizeSentences(
      'Ignore this. Use config.yml somewhere.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'z',
      'Edit',
      'load config.yml into memory',
      {
        file_path: '/abs/z',
        old_string: 'x',
        new_string: 'load config.yml into memory',
      },
    );
    expect(result?.text).toBe('Use config.yml somewhere.');
  });

  it('falls back to Edit new_string when postContent is empty (edit miss)', () => {
    // postContent '' simulates the file-state engine rejecting the
    // edit. Without fallback, only path/operation tokens would score,
    // missing the AI's intended content which is the whole point of
    // intent mapping.
    const sentences = tokenizeSentences(
      'Hello world. Add the UserGreet helper.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'x.unknown',
      'Edit',
      '',
      {
        file_path: '/abs/x.unknown',
        old_string: 'old',
        new_string: "export const UserGreet = () => 'hi';",
      },
    );
    expect(result?.text).toBe('Add the UserGreet helper.');
  });

  it('falls back to concatenated MultiEdit new_strings when postContent is empty', () => {
    const sentences = tokenizeSentences(
      'Hello world. Update both UserGreet and AdminWelcome.',
    );
    const result = pickTriggeringSentence(
      sentences,
      'x.unknown',
      'MultiEdit',
      '',
      {
        file_path: '/abs/x.unknown',
        edits: [
          { old_string: 'a', new_string: 'const UserGreet = 1;' },
          { old_string: 'b', new_string: 'const AdminWelcome = 2;' },
        ],
      },
    );
    expect(result?.text).toBe('Update both UserGreet and AdminWelcome.');
  });
});
