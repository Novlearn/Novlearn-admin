import captured from './publication-journal-sql.json';
import { certifiedEngineIdentity } from '@/lib/engine-identity';

// Synthetic metadata for current-build orchestration unit tests. The original
// SQL/native capture remains untouched and continues to test historical reads.
// This fixture does not claim a new native run, SQL approval or publication.
export const currentPublicationFixture = structuredClone(captured);
currentPublicationFixture.payload.engineArchiveSha256 =
  certifiedEngineIdentity.engineArchiveSha256;
currentPublicationFixture.inspection.state.runtime.engineArchiveSha256 =
  certifiedEngineIdentity.engineArchiveSha256;
