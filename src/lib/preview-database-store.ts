import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExerciseInstance } from 'novlearn-exercise-engine';
import {
  PreviewError,
  definitionDigest,
  type Snapshot,
  type SnapshotRepository,
} from './preview-server';
import { certifiedEngineIdentity } from './engine-identity';
import { isUuid } from './catalogue';

/** Caller-session RPC; the private table is never exposed through the Data API. */
export class DatabasePreviewStore implements SnapshotRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly signal: AbortSignal,
  ) {}
  private async call(
    name: string,
    args: Record<string, unknown>,
    owner: string,
  ) {
    this.signal.throwIfAborted();
    const { data, error } = await this.client
      .rpc(name, args)
      .abortSignal(this.signal);
    if (error) {
      if (error.code === 'P0002')
        throw new PreviewError(410, 'Aperçu expiré ou indisponible.');
      if (error.code === 'P0001')
        throw new PreviewError(429, 'Capacité des aperçus atteinte.');
      throw new PreviewError(503, 'Stockage privé des aperçus indisponible.');
    }
    if (
      !data ||
      data.owner !== owner ||
      !isUuid(data.previewId) ||
      !/^[a-f0-9]{64}$/.test(data.digest) ||
      !Number.isSafeInteger(data.seed) ||
      data.seed < 0 ||
      data.seed > 0xffffffff ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt <= Date.now() ||
      data.expiresAt > Date.now() + 600000 ||
      data.artifact !== certifiedEngineIdentity.engineArchiveSha256 ||
      !data.official ||
      data.official.schemaVersion !== 5 ||
      data.official.engineVersion !== '0.1.0' ||
      Buffer.byteLength(JSON.stringify(data.official)) > 524288
    )
      throw new PreviewError(503, 'Instantané privé incompatible.');
    return {
      previewId: data.previewId as string,
      owner,
      digest: data.digest as string,
      seed: data.seed as number,
      official: data.official as ExerciseInstance,
      expiresAt: data.expiresAt as number,
      bytes: Buffer.byteLength(JSON.stringify(data.official)),
    };
  }
  async put(
    owner: string,
    digest: string,
    seed: number,
    official: ExerciseInstance,
  ) {
    const snapshot = await this.call(
      'admin_put_preview_snapshot',
      {
        p_digest: digest,
        p_seed: seed,
        p_official: official,
        p_artifact: certifiedEngineIdentity.engineArchiveSha256,
      },
      owner,
    );
    if (
      snapshot.digest !== digest ||
      snapshot.seed !== seed ||
      definitionDigest(snapshot.official) !== definitionDigest(official)
    )
      throw new PreviewError(503, 'Instantané privé incohérent.');
    return snapshot;
  }
  async get(owner: string, id: string): Promise<Snapshot> {
    const snapshot = await this.call(
      'admin_get_preview_snapshot',
      { p_id: id, p_artifact: certifiedEngineIdentity.engineArchiveSha256 },
      owner,
    );
    if (snapshot.previewId !== id)
      throw new PreviewError(503, 'Instantané privé incohérent.');
    return snapshot;
  }
}
