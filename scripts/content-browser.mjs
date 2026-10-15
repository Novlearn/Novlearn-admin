// Synthetic UI harnesses only; never loads Auth configuration or Supabase.
import { createServer } from 'vite';
import { localWorkspaceConfig } from './local-workspace.mjs';
import './prepare-mathlive.mjs';
const server = await createServer(localWorkspaceConfig());
await server.listen();
console.log(
  'Local workspace (no Engine/database): http://127.0.0.1:3140/ ; type stop to close.',
);
process.stdin.on('data', async (value) => {
  if (String(value).trim() === 'stop') {
    await server.close();
    process.exit(0);
  }
});
