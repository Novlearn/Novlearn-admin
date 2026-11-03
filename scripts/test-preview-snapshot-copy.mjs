import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const docker =
  process.env.LOCALAPPDATA + '/Programs/DockerDesktop/resources/bin/docker.exe';
const base = ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine'];
const container = 'novlearn-m1-snapshot-copy';
for (const file of [
  'preview-snapshots.sql',
  'preview-snapshots-rollback.sql',
  'test-preview-snapshots.sql',
])
  execFileSync(
    docker,
    [
      ...base,
      'cp',
      resolve('scripts/proposals', file),
      `${container}:/tmp/${file}`,
    ],
    { windowsHide: true },
  );
const output = execFileSync(
  docker,
  [
    ...base,
    'exec',
    container,
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-f',
    '/tmp/test-preview-snapshots.sql',
  ],
  { encoding: 'utf8', windowsHide: true, timeout: 30000 },
);
console.log(output);
