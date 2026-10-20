import { expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
it.each([
  [
    'test-active-version-http-local.mjs',
    'local-admin-publication-1792259029889',
    '55432',
  ],
  ['test-active-version-main-local.mjs', 'local-admin-1792143739689', '55431'],
])(
  '%s refuses a remote Auth URL before credentials, network or state mutation',
  async (script, workspace, port) => {
    const root = await mkdtemp(path.join(tmpdir(), 'novlearn-reader-origin-'));
    await mkdir(path.join(root, '.local', workspace), { recursive: true });
    await mkdir(path.join(root, '.local/lot1a'), { recursive: true });
    await writeFile(
      path.join(root, '.local/lot1a/active-version-http-current.json'),
      JSON.stringify({ phase: 'qualified-pg' }),
    );
    await writeFile(
      path.join(root, '.local', workspace, 'private.json'),
      JSON.stringify({
        authConfig: { ADMIN_LOCAL_SUPABASE_URL: 'https://remote.invalid' },
      }),
    );
    const scriptPath = path.resolve('scripts', script);
    const program = `import {writeFileSync} from 'node:fs';globalThis.fetch=()=>{writeFileSync('unexpected-fetch','called');throw Error('Network must not be used');};process.argv=[process.execPath,${JSON.stringify(scriptPath)}];await import(${JSON.stringify(pathToFileURL(scriptPath).href)});`;
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', program],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(
      'Only the retained local Auth fixture is permitted',
    );
    expect(r.stderr).toContain('127.0.0.1:' + port);
    await expect(
      access(path.join(root, 'unexpected-fetch')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  },
);
