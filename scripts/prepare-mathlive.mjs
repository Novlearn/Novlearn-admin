import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const fonts = new URL('public/mathlive/fonts/', root);
await mkdir(fonts, { recursive: true });
await cp(
  fileURLToPath(new URL('node_modules/mathlive/fonts/', root)),
  fileURLToPath(fonts),
  { recursive: true },
);
await cp(
  fileURLToPath(new URL('node_modules/mathlive/LICENSE.txt', root)),
  fileURLToPath(new URL('public/mathlive/LICENSE.txt', root)),
);
console.log('Local MathLive fonts prepared.');
