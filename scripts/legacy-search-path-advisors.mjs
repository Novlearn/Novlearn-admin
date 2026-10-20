// Official advisors for NEW SQL71 fixture clusters only. No host port, Docker
// socket, network access, global trust installation or relaxed TLS verification.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function legacySearchPathAdvisors({
  artifact,
  container,
  owner,
  output,
  cli,
}) {
  assert.match(
    container,
    /^novlearn-admin-legacy-path-(?:(?:restored|advisor-baseline)-)?\d+$/,
  );
  assert.equal(
    path.dirname(path.resolve(artifact)),
    path.resolve('.local/lot1a'),
  );
  assert.match(output, /^(before|after)-advisors$/);
  assert.match(owner, /^[0-9a-f]{48}$/);
  const state = JSON.parse(cli(['inspect', container]).stdout)[0];
  assert.equal(state.State.Running, true);
  assert.equal(state.HostConfig.NetworkMode, 'none');
  assert.deepEqual(state.HostConfig.PortBindings, {});
  const directory = path.join(artifact, output);
  await mkdir(directory, { recursive: true });
  await mkdir(directory + '/runner/node_modules', { recursive: true });
  await copyFile(
    'scripts/test-active-version-advisors-worker.mjs',
    directory + '/runner/worker.mjs',
  );
  const sql = (q) =>
    cli(
      [
        'exec',
        '-i',
        container,
        'psql',
        '-qAt',
        '-U',
        'supabase_admin',
        '-d',
        'admin_local',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      q,
    ).stdout.trim();
  const certificate = path.resolve(
    '.local/lot1a/active-version-pg-1792436591935',
  );
  for (const ext of ['key', 'crt'])
    cli([
      'cp',
      certificate + '/server.' + ext,
      container + ':/tmp/local-legacy-advisor.' + ext,
    ]);
  cli([
    'exec',
    container,
    'chown',
    'postgres:postgres',
    '/tmp/local-legacy-advisor.key',
    '/tmp/local-legacy-advisor.crt',
  ]);
  cli([
    'exec',
    '--user',
    'postgres',
    container,
    'chmod',
    '600',
    '/tmp/local-legacy-advisor.key',
  ]);
  for (const [k, v] of [
    ['ssl_cert_file', '/tmp/local-legacy-advisor.crt'],
    ['ssl_key_file', '/tmp/local-legacy-advisor.key'],
    ['ssl', 'on'],
  ])
    sql(`ALTER SYSTEM SET ${k}='${v}';`);
  sql('SELECT pg_reload_conf();');
  assert.equal(sql('SHOW ssl;'), 'on');
  await writeFile(
    directory + '/private.json',
    JSON.stringify({
      owner,
      ca: await readFile(certificate + '/server.crt', 'utf8'),
    }) + '\n',
    { mode: 0o600 },
  );
  const binary = path.resolve(
    '.local/lot1a/supabase-cli-linux-2.98.2/supabase',
  );
  assert.equal(
    createHash('sha256')
      .update(await readFile(binary))
      .digest('hex'),
    '94e6d7a9b6d674126144cecbfc64ce871189c0cfd88f19acb2a1675200f674d2',
  );
  const execution = cli(
    [
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'container:' + container,
      '--cpus',
      '2',
      '--memory',
      '384m',
      '--memory-swap',
      '384m',
      '--pids-limit',
      '64',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--tmpfs',
      '/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777',
      '--workdir',
      '/output',
      '--mount',
      `type=bind,source=${binary},target=/tool/supabase,readonly`,
      '--mount',
      `type=bind,source=${directory},target=/output`,
      '--mount',
      `type=bind,source=${directory}/runner,target=/runner,readonly`,
      '--mount',
      `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
      'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
      'node',
      '/runner/worker.mjs',
    ],
    undefined,
    true,
  );
  await writeFile(
    directory + '/execution.log',
    (String(execution.stdout) + '\n' + String(execution.stderr)).replaceAll(
      owner,
      '[fixture owner]',
    ),
  );
  assert.equal(
    execution.status,
    0,
    'Inspect retained advisor execution: ' + directory,
  );
  return {
    findings: JSON.parse(
      await readFile(directory + '/advisors.stdout', 'utf8'),
    ),
    proof: JSON.parse(await readFile(directory + '/worker-proof.json', 'utf8')),
    directory,
  };
}
