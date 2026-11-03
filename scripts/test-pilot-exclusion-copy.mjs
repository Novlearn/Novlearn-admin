import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const docker =
  process.env.LOCALAPPDATA + '/Programs/DockerDesktop/resources/bin/docker.exe';
const base = ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine'];
const container = 'novlearn-m1-snapshot-copy';
for (const file of [
  'exclude-unpublished-pilots.sql',
  'exclude-unpublished-pilots-rollback.sql',
  'test-exclude-unpublished-pilots.sql',
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
console.log(
  execFileSync(
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
      '/tmp/test-exclude-unpublished-pilots.sql',
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 },
  ),
);
