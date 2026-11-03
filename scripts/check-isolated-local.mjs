// Run the unchanged complete check on an exact allowlisted source copy, so a
// development instance can remain available. No .env, .git or private state is copied.
import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  cp,
  readdir,
  stat,
  open,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
const source = process.cwd(),
  artifact = path.join(tmpdir(), 'novlearn-admin-check-' + Date.now());
await mkdir(artifact);
const entries = [
  'src',
  'tests',
  'scripts',
  'docs',
  'public',
  'vendor',
  'examples',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'vercel.json',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'vitest.config.ts',
  'eslint.config.mjs',
  '.prettierignore',
  '.prettierrc.json',
  'components.json',
  'README.md',
  'CDC_reference.md',
];
const hashes = {};
async function copy(entry) {
  await cp(path.join(source, entry), path.join(artifact, entry), {
    recursive: true,
  });
  const files = (await stat(entry)).isDirectory()
    ? (await readdir(entry, { recursive: true })).map((f) =>
        path.join(entry, f),
      )
    : [entry];
  for (const file of files) {
    if (!(await stat(file)).isFile()) continue;
    const a = await readFile(file),
      b = await readFile(path.join(artifact, file));
    assert(a.equals(b), file);
    hashes[file.replaceAll('\\', '/')] = createHash('sha256')
      .update(a)
      .digest('hex');
  }
}
for (const entry of entries) await copy(entry);
// A nested copy makes Next infer the parent repository as a monorepo root.
// Physical dependency copies keep tracing and standalone output self-contained.
await cp(path.resolve('node_modules'), artifact + '/node_modules', {
  recursive: true,
  dereference: true,
});
await writeFile(
  artifact + '/next-env.d.ts',
  '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
);
await writeFile(
  artifact + '/source-hashes.json',
  JSON.stringify(
    { source, artifact, date: new Date().toISOString(), hashes },
    null,
    2,
  ) + '\n',
);
const env = { ...process.env };
for (const key of Object.keys(env))
  if (key.startsWith('ADMIN_') || key.startsWith('NEXT_PUBLIC_SUPABASE_'))
    delete env[key];
delete env.NODE_ENV;
const log = await open(artifact + '/check.log', 'w');
const child = spawn(
  process.execPath,
  [
    path.join(
      path.dirname(process.execPath),
      'node_modules/npm/bin/npm-cli.js',
    ),
    'run',
    'check',
  ],
  { cwd: artifact, env, windowsHide: true, stdio: ['ignore', log.fd, log.fd] },
);
await writeFile(
  '.local/last-isolated-check.json',
  JSON.stringify(
    { artifact, processId: child.pid, sourceFiles: Object.keys(hashes).length },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    stage: 'running',
    artifact,
    processId: child.pid,
    sourceFiles: Object.keys(hashes).length,
  }),
);
const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});
await log.close();
// Reject a pass for stale copied code, rather than quietly changing its scope.
for (const [file, expected] of Object.entries(hashes))
  assert.equal(
    createHash('sha256')
      .update(await readFile(path.join(source, file)))
      .digest('hex'),
    expected,
    'Source changed during isolated check: ' + file,
  );
const text = await readFile(artifact + '/check.log', 'utf8');
const testSummary = text.match(/^\s*Tests\s+([^\r\n]+)/m)?.[1] ?? '',
  fileSummary = text.match(/^\s*Test Files\s+([^\r\n]+)/m)?.[1] ?? '';
const tests = Number(testSummary.match(/(\d+) passed/)?.[1] ?? 0),
  files = Number(fileSummary.match(/(\d+) passed/)?.[1] ?? 0),
  failedTests = Number(testSummary.match(/(\d+) failed/)?.[1] ?? 0),
  failedFiles = Number(fileSummary.match(/(\d+) failed/)?.[1] ?? 0);
const result = {
  result: exitCode === 0 ? 'PASS' : 'FAIL',
  date: new Date().toISOString(),
  artifact,
  exitCode,
  tests,
  files,
  failedTests,
  failedFiles,
  sourceFiles: Object.keys(hashes).length,
  allCopiedSourcesStillMatch: true,
  fullCheckCommand: 'npm run check',
  separateBuildDirectory: true,
  independentTemporaryProject: true,
  dependenciesCopied: true,
  applicationServersInterrupted: false,
  privateEnvironmentFilesCopied: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result));
process.exitCode = exitCode;
