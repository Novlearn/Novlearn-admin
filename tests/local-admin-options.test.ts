import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
const run = (name: string, flags: string[]) =>
  spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import {${name}} from './scripts/local-admin-options.mjs'; console.log(JSON.stringify(${name}(JSON.parse(process.argv[1]))));`,
      JSON.stringify(['.local/synthetic-workspace', ...flags]),
    ],
    { encoding: 'utf8', windowsHide: true },
  );
describe('explicit local target-reader launcher policy', () => {
  it.each(['localAdminOptions', 'localPublicationOptions'])(
    '%s defaults closed and accepts independent read-only opt-in',
    (name) => {
      const disabled = run(name, []),
        enabled = run(name, ['--active-version']);
      expect(disabled.status).toBe(0);
      expect(JSON.parse(disabled.stdout).activeVersion).toBe(false);
      expect(enabled.status).toBe(0);
      expect(JSON.parse(enabled.stdout).activeVersion).toBe(true);
    },
  );
  it.each(['localAdminOptions', 'localPublicationOptions'])(
    '%s refuses stop/activation, duplicates and unknown options',
    (name) => {
      for (const flags of [
        ['--stop', '--active-version'],
        ['--active-version', '--active-version'],
        ['--production'],
      ])
        expect(run(name, flags).status).not.toBe(0);
    },
  );
  it('preserves the full main capability set and its existing dependencies', () => {
    const r = run('localAdminOptions', [
      '--engine',
      '--review',
      '--statistics',
      '--users',
      '--user-detail',
      '--pedagogy',
      '--active-version',
    ]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      engine: true,
      review: true,
      statistics: true,
      users: true,
      userDetail: true,
      pedagogy: true,
      activeVersion: true,
    });
    expect(
      run('localAdminOptions', ['--review', '--active-version']).status,
    ).not.toBe(0);
    expect(
      run('localAdminOptions', ['--pedagogy', '--active-version']).status,
    ).not.toBe(0);
  });
  it('does not accept general main flags on the dedicated publication workspace', () =>
    expect(run('localPublicationOptions', ['--engine']).status).not.toBe(0));
});
