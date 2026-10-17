// Preparation only: a separate local Auth/REST/SQL source. No application
// server, target writer or publication is enabled by creating this workspace.
import { createLocalAdmin } from './create-local-admin.mjs';
import { localNetworkOptions } from './local-network-options.ts';

await createLocalAdmin({
  publicationFixture: true,
  subnets: localNetworkOptions(process.argv.slice(2)),
});
