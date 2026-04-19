import { describe, it, expect } from 'vitest';
import { classifySector, SECTOR_RULES } from '../src/index.js';

describe('classifySector', () => {
  it.each([
    ['db/migrate/20260418_create_users.rb', 'migrations'],
    ['migrations/0042_add_col.sql', 'migrations'],
    ['some/thing.sql', 'migrations'],
    ['app/models/user.rb', 'models'],
    ['models/user.ts', 'models'],
    ['app/controllers/users_controller.rb', 'controllers'],
    ['controllers/api.ts', 'controllers'],
    ['app/views/users/show.html.erb', 'views'],
    ['templates/base.html', 'views'],
    ['views/layout.ejs', 'views'],
    ['spec/user_spec.rb', 'tests'],
    ['test/foo.rb', 'tests'],
    ['tests/foo.js', 'tests'],
    ['src/user_test.ts', 'tests'],
    ['config/database.yml', 'config'],
    ['docker-compose.yml', 'config'],
    ['project/.env', 'config'],
    ['app/.env.local', 'config'],
    ['lib/tasks/deploy.rake', 'tasks'],
    ['Rakefile', 'tasks'],
    ['sub/Rakefile', 'tasks'],
    ['misc.rake', 'tasks'],
    ['src/main.ts', 'other'],
    ['README.md', 'other'],
    ['somewhere/.environment.rb', 'other'],
  ] as const)('classifies %s as %s', (path, expected) => {
    expect(classifySector(path)).toBe(expected);
  });

  it('SECTOR_RULES is declarative, in spec order, exported for downstream reuse', () => {
    expect(SECTOR_RULES.map((r) => r.sector)).toEqual([
      'migrations',
      'models',
      'controllers',
      'views',
      'tests',
      'config',
      'tasks',
    ]);
  });

  it('first-match-wins: db/migrate under app/ still classifies as migrations', () => {
    expect(classifySector('app/db/migrate/001_init.rb')).toBe('migrations');
  });

  it('first-match-wins: a file under test/models/ classifies as models, not tests', () => {
    // The models rule appears before the tests rule in SECTOR_RULES, so the
    // earlier rule wins even when later rules would also match. Locks the
    // spec-defined ordering so a reorder doesn't silently change outputs.
    expect(classifySector('test/models/user_test.rb')).toBe('models');
  });

  it('Rakefile matches only at an exact path segment (not a prefix)', () => {
    expect(classifySector('Rakefile')).toBe('tasks');
    expect(classifySector('lib/Rakefile')).toBe('tasks');
    expect(classifySector('Rakefilex')).toBe('other');
  });
});
