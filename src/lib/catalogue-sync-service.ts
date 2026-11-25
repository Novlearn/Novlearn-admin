import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeAdmin, type AuthGateway } from './auth/authorization';
import { isFingerprint, isUuid } from './catalogue';
import {
  catalogueSyncInspection,
  catalogueSyncPayload,
  catalogueSyncReceipt,
  catalogueSyncReceiptMatches,
  catalogueSyncTargetErrorClass,
  type CatalogueSyncCandidate,
  type CatalogueSyncPayload,
  type CatalogueSyncReceipt,
} from './catalogue-sync';
import type { CatalogueSyncConfiguration } from './catalogue-sync-config';
import {
  createPublicationPgPools,
  type PublicationConnection,
} from './publication-pg';

export class CatalogueSyncError extends Error {
  constructor(
    public readonly code:
      | 'disabled'
      | 'forbidden'
      | 'invalid'
      | 'conflict'
      | 'blocked'
      | 'uncertain'
      | 'unavailable',
    public readonly sqlState: string | null = null,
  ) {
    super(code);
  }
}

type Operation = {
  id: string;
  planDigest: string;
  payload: CatalogueSyncPayload;
  inspection: Record<string, unknown>;
  state: string;
  expiresAt: string;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!object(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
const errorCode = (error: unknown) =>
  error &&
  typeof error === 'object' &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null;
const asOperation = (value: unknown): Operation | null => {
  if (!object(value)) return null;
  const payload = catalogueSyncPayload(value.payload),
    inspection = catalogueSyncInspection(value.inspection),
    id = value.id,
    planDigest = value.plan_digest ?? value.planDigest,
    state = value.state,
    expiresAt = value.expires_at ?? value.expiresAt;
  return isUuid(id) &&
    isFingerprint(planDigest) &&
    payload &&
    inspection &&
    typeof state === 'string' &&
    typeof expiresAt === 'string' &&
    Number.isFinite(Date.parse(expiresAt))
    ? { id, planDigest, payload, inspection, state, expiresAt }
    : null;
};
const authFailure = async (auth: AuthGateway, expected: string) => {
  const access = await authorizeAdmin(auth);
  if (!access.allowed)
    throw new CatalogueSyncError(
      access.reason === 'unavailable' ? 'unavailable' : 'forbidden',
    );
  if (access.userId !== expected) throw new CatalogueSyncError('forbidden');
};

/** Server-side transfer through the catalogue sync SQL contract. */
export class CatalogueSyncService {
  private readonly pools;
  constructor(
    private readonly auth: AuthGateway,
    private readonly sourceClient: SupabaseClient,
    private readonly config: CatalogueSyncConfiguration,
  ) {
    this.pools = createPublicationPgPools(config);
  }
  async close() {
    await this.pools.close();
  }

  async targetReady() {
    return catalogueSyncTargetReady(this.pools);
  }

  async list(after = '', limit = 50) {
    if (
      after.length > 200 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new CatalogueSyncError('invalid');
    const { data, error } = await this.sourceClient.rpc(
      'admin_list_catalogue_sync_ready',
      {
        p_after: after,
        p_limit: limit,
      },
    );
    if (error) throw this.sourceError(error);
    return data;
  }

  private sourceError(error: { code?: string }) {
    return new CatalogueSyncError(
      error.code === '42501'
        ? 'forbidden'
        : error.code === '23503'
          ? 'blocked'
          : error.code === '40001' || error.code === 'PT409'
            ? 'conflict'
            : 'unavailable',
      error.code ?? null,
    );
  }

  async prepare(batchId: string, candidates: CatalogueSyncCandidate[]) {
    if (
      !isUuid(batchId) ||
      candidates.length < 1 ||
      candidates.length > 100 ||
      candidates.some((c) => !c || c.status === 'blocked') ||
      new Set(candidates.map((c) => `${c.kind}:${c.catalogId}`)).size !==
        candidates.length
    )
      throw new CatalogueSyncError('invalid');
    const actor = await authorizeAdmin(this.auth);
    if (!actor.allowed)
      throw new CatalogueSyncError(
        actor.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    const prepared: {
      operation: Operation;
      candidate: CatalogueSyncCandidate;
    }[] = [];
    try {
      for (const candidate of candidates) {
        await authFailure(this.auth, actor.userId);
        const { data: rawPayload, error: exportError } =
          await this.sourceClient.rpc('admin_export_catalogue_sync_item', {
            p_kind: candidate.kind,
            p_catalog_id: candidate.catalogId,
            p_expected_fingerprint: candidate.fingerprint,
          });
        if (exportError) throw this.sourceError(exportError);
        const payload = catalogueSyncPayload(rawPayload);
        if (
          !payload ||
          payload.kind !== candidate.kind ||
          payload.catalogId !== candidate.catalogId ||
          payload.fingerprint !== candidate.fingerprint
        )
          throw new CatalogueSyncError('conflict');
        const target = await this.pools.target();
        let inspectionValue: unknown;
        try {
          const result = await target.query(
            'SELECT novlearn_admin_private.inspect_catalogue_sync_item($1::text,$2::uuid) AS inspection',
            [candidate.kind, candidate.catalogId],
          );
          inspectionValue = result.rows[0]?.inspection;
        } finally {
  6çí¢G§²ÚîÆ­yÕÐÑ¡¥Ì¹É•½É (€€€€€€€€€…Ñ½É%°(€€€€€€€€€‰…Ñ¡%°(€€€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€€€•á•ÕÑ¥¹œœ°(€€€€€€€€€€Õ¹•ÉÑ…¥¸œ°(€€€€€€€€€¹Õ±°°(€€€€€€€€€¹Õ±°°(€€€€€€€€¤¹…Ñ   ¤€ôøÕ¹‘•™¥¹•¤ì(€€€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È Õ¹•ÉÑ…¥¸œ°É•©•Ñ•¤ì(€€€€€ô(€€€ô(€€€ÑÉäì(€€€€€…Ý…¥ÐÑ¡¥Ì¹É•½É (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€•á•ÕÑ¥¹œœ°(€€€€€€€€½µµ¥ÑÑ•œ°(€€€€€€€É••¥ÁÐ°(€€€€€€€¹Õ±°°(€€€€€€¤ì(€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€½µµ¥ÑÑ•œ…Ì½¹ÍÐ°É••¥ÁÐôì(€€€ô…Ñ ì(€€€€€…Ý…¥ÐÑ¡¥Ì¹É•½É (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€•á•ÕÑ¥¹œœ°(€€€€€€€€Õ¹•ÉÑ…¥¸œ°(€€€€€€€¹Õ±°°(€€€€€€€¹Õ±°°(€€€€€€¤¹…Ñ   ¤€ôøÕ¹‘•™¥¹•¤ì(€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È Õ¹•ÉÑ…¥¸œ¤ì(€€€ô(€ô((€…Íå¹ŒÉ•½Ù•È¡…Ñ½É%èÍÑÉ¥¹œ°‰…Ñ¡%èÍÑÉ¥¹œ°Á…å±½…‘¥•ÍÐèÍÑÉ¥¹œ¤ì(€€€¥˜€ …¥ÍUÕ¥¡‰…Ñ¡%¤ñð€…¥Í¥¹•ÉÁÉ¥¹Ð¡Á…å±½…‘¥•ÍÐ¤¤(€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È ¥¹Ù…±¥œ¤ì(€€€…Ý…¥Ð…ÕÑ¡…¥±ÕÉ”¡Ñ¡¥Ì¹…ÕÑ °…Ñ½É%¤ì(€€€½¹ÍÐÍ½ÕÉ”€ô…Ý…¥ÐÑ¡¥Ì¹Á½½±Ì¹Í½ÕÉ” ¤ì(€€€±•Ð‰…Ñ¡¥•ÍÐèÕ¹­¹½Ý¸ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÍ½ÕÉ”¹ÅÕ•Éä (€€€€€€€€M1P¹½Ù±•…É¹}…‘µ¥¹}ÁÉ¥Ù…Ñ”¹…Ñ…±½Õ•}Íå¹}‰…Ñ¡}‘¥•ÍÐ ÄèéÕÕ¥¤L‘¥•ÍÐœ°(€€€€€€€m‰…Ñ¡%‘t°(€€€€€€¤ì(€€€€€‰…Ñ¡¥•ÍÐ€ôÉ•ÍÕ±Ð¹É½ÝÍlÁtü¹‘¥•ÍÐì(€€€ô™¥¹…±±äì(€€€€€Í½ÕÉ”¹É•±•…Í” ¤ì(€€€ô(€€€¥˜€ …¥Í¥¹•ÉÁÉ¥¹Ð¡‰…Ñ¡¥•ÍÐ¤¤(€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È Õ¹…Ù…¥±…‰±”œ¤ì(€€€É•ÑÕÉ¸Ñ¡¥Ì¹Ý¥Ñ¡Q…É•Ñ1•…Í” ¡Ñ…É•Ð¤€ôø(€€€€€Ñ¡¥Ì¹É•½¹¥±•	…Ñ ¡Ñ…É•Ð°…Ñ½É%°‰…Ñ¡%°‰…Ñ¡¥•ÍÐ°Á…å±½…‘¥•ÍÐ¤°(€€€€¤ì(€ô((€ÁÉ¥Ù…Ñ”…Íå¹ŒÉ•½¹¥±•	…Ñ  (€€€Ñ…É•ÐèAÕ‰±¥…Ñ¥½¹½¹¹•Ñ¥½¸°(€€€…Ñ½É%èÍÑÉ¥¹œ°(€€€‰…Ñ¡%èÍÑÉ¥¹œ°(€€€‰…Ñ¡¥•ÍÐèÍÑÉ¥¹œ°(€€€Á…å±½…‘¥•ÍÐèÍÑÉ¥¹œ°(€€¤ì(€€€½¹ÍÐ½‰Í•ÉÙ•€ô…Ý…¥ÐÑ¡¥Ì¹½‰Í•ÉÙ•Q…É•Ð¡Ñ…É•Ð°‰…Ñ¡%°Á…å±½…‘¥•ÍÐ¤ì(€€€¥˜€¡½‰Í•ÉÙ•¹ÍÑ…Ñ”€ôôô€½µµ¥ÑÑ•œ€˜˜½‰Í•ÉÙ•¹É••¥ÁÐ¤ì(€€€€€…Ý…¥ÐÑ¡¥Ì¹É•½É‘I•½Ù•É¥¹œ (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€½µµ¥ÑÑ•œ°(€€€€€€€½‰Í•ÉÙ•¹É••¥ÁÐ°(€€€€€€€¹Õ±°°(€€€€€€¤ì(€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€½µµ¥ÑÑ•œ…Ì½¹ÍÐ°É••¥ÁÐè½‰Í•ÉÙ•¹É••¥ÁÐôì(€€€ô(€€€¥˜€¡½‰Í•ÉÙ•¹ÍÑ…Ñ”€ôôô€¹½Ñ}…ÁÁ±¥•œ¤ì(€€€€€…Ý…¥ÐÑ¡¥Ì¹É•½É‘I•½Ù•É¥¹œ (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€™…¥±•œ°(€€€€€€€¹Õ±°°(€€€€€€€€¹½Ñ}…ÁÁ±¥•œ°(€€€€€€¤ì(€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€™…¥±•œ…Ì½¹ÍÐ°É••¥ÁÐè¹Õ±°ôì(€€€ô(€€€…Ý…¥ÐÑ¡¥Ì¹É•½É‘I•½Ù•É¥¹œ (€€€€€…Ñ½É%°(€€€€€‰…Ñ¡%°(€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€Õ¹•ÉÑ…¥¸œ°(€€€€€¹Õ±°°(€€€€€¹Õ±°°(€€€€¤¹…Ñ   ¤€ôøÕ¹‘•™¥¹•¤ì(€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œ…Ì½¹ÍÐ°É••¥ÁÐè¹Õ±°ôì(€ô((€ÁÉ¥Ù…Ñ”…Íå¹ŒÉ•½É‘I•½Ù•É¥¹œ (€€€…Ñ½É%èÍÑÉ¥¹œ°(€€€‰…Ñ¡%èÍÑÉ¥¹œ°(€€€‰…Ñ¡¥•ÍÐèÍÑÉ¥¹œ°(€€€ÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œð€½µµ¥ÑÑ•œð€™…¥±•œ°(€€€É••¥ÁÐè…Ñ…±½Õ•Må¹I••¥ÁÐð¹Õ±°°(€€€•ÉÉ½Èè€¹½Ñ}…ÁÁ±¥•œð¹Õ±°°(€€¤ì(€€€ÑÉäì(€€€€€É•ÑÕÉ¸…Ý…¥ÐÑ¡¥Ì¹É•½É (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€Õ¹•ÉÑ…¥¸œ°(€€€€€€€ÍÑ…Ñ”°(€€€€€€€É••¥ÁÐ°(€€€€€€€•ÉÉ½È°(€€€€€€¤ì(€€€ô…Ñ €¡™…¥±ÕÉ”¤ì(€€€€€¥˜€ (€€€€€€€€„¡™…¥±ÕÉ”¥¹ÍÑ…¹•½˜…Ñ…±½Õ•Må¹ÉÉ½È¤ñð(€€€€€€€™…¥±ÕÉ”¹½‘”€„ôô€½¹™±¥Ðœ(€€€€€€¤(€€€€€€€Ñ¡É½Ü™…¥±ÕÉ”ì(€€€€€É•ÑÕÉ¸Ñ¡¥Ì¹É•½É (€€€€€€€…Ñ½É%°(€€€€€€€‰…Ñ¡%°(€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€•á•ÕÑ¥¹œœ°(€€€€€€€ÍÑ…Ñ”°(€€€€€€€É••¥ÁÐ°(€€€€€€€•ÉÉ½È°(€€€€€€¤ì(€€€ô(€ô((€€¼¨¨!½±Ñ¡”ME0½¹ÑÉ…ÐÌ±½¬…É½ÍÌÑ¡”Í½ÕÉ”ÑÉ…¹Í¥Ñ¥½¸Ñ½¼°Í¼É•½Ù•Éä(€€€¨…¹¹½Ð½‰Í•ÉÙ”…‰Í•¹”‰•ÑÝ••¸„±…¥´…¹¥ÑÌÑ…É•ÐÑÉ…¹Í…Ñ¥½¸¸€¨¼(€ÁÉ¥Ù…Ñ”…Íå¹ŒÝ¥Ñ¡Q…É•Ñ1•…Í”ñPø (€€€Ý½É¬è€¡Ñ…É•ÐèAÕ‰±¥…Ñ¥½¹½¹¹•Ñ¥½¸¤€ôøAÉ½µ¥Í”ñPø°(€€¤ì(€€€½¹ÍÐÑ…É•Ð€ô…Ý…¥ÐÑ¡¥Ì¹Á½½±Ì¹Ñ…É•Ð ¤ì(€€€±•Ð±½­•€ô™…±Í”ì(€€€±•Ð‘•ÍÑÉ½ä€ôÑÉÕ”ì(€€€ÑÉäì(€€€€€…Ý…¥ÐÑ…É•Ð¹ÅÕ•Éä (€€€€€€€€‰M1PÁ}…Ñ…±½œ¹Á}…‘Ù¥Í½Éå}±½¬¡Á}…Ñ…±½œ¹¡…Í¡Ñ•áÑ•áÑ•¹‘• ¹½Ù±•…É¸µ…Ñ…±½Õ”µÍå¹ŒµØÄœ°À¤¤ˆ°(€€€€€€¤ì(€€€€€±½­•€ôÑÉÕ”ì(€€€€€É•ÑÕÉ¸…Ý…¥ÐÝ½É¬¡Ñ…É•Ð¤ì(€€€ô™¥¹…±±äì(€€€€€¥˜€¡±½­•¤ì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÑ…É•Ð¹ÅÕ•Éä (€€€€€€€€€€€€‰M1PÁ}…Ñ…±½œ¹Á}…‘Ù¥Í½Éå}Õ¹±½¬¡Á}…Ñ…±½œ¹¡…Í¡Ñ•áÑ•áÑ•¹‘• ¹½Ù±•…É¸µ…Ñ…±½Õ”µÍå¹ŒµØÄœ°À¤¤LÕ¹±½­•ˆ°(€€€€€€€€€€¤ì(€€€€€€€€€‘•ÍÑÉ½ä€ôÉ•ÍÕ±Ð¹É½ÝÍlÁtü¹Õ¹±½­•€„ôôÑÉÕ”ì(€€€€€€€ô…Ñ ì(€€€€€€€€€€¼¼¼¹½ÐÉ•ÕÍ”„Í•ÍÍ¥½¸Ý¡½Í”±½¬É•±•…Í”Ý…Ì¹½Ð½¹™¥Éµ•¸(€€€€€€€ô(€€€€€ô(€€€€€Ñ…É•Ð¹É•±•…Í”¡‘•ÍÑÉ½ä¤ì(€€€ô(€ô((€ÁÉ¥Ù…Ñ”…Íå¹Œ½‰Í•ÉÙ•Q…É•Ð (€€€Ñ…É•ÐèAÕ‰±¥…Ñ¥½¹½¹¹•Ñ¥½¸°(€€€‰…Ñ¡%èÍÑÉ¥¹œ°(€€€Á…å±½…‘¥•ÍÐèÍÑÉ¥¹œ°(€€¤ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÑ…É•Ð¹ÅÕ•Éä (€€€€€€€€M1P¹½Ù±•…É¹}…‘µ¥¹}ÁÉ¥Ù…Ñ”¹½‰Í•ÉÙ•}…Ñ…±½Õ•}Íå¹}‰…Ñ  ÄèéÕÕ¥°ÈèéÑ•áÐ¤L½‰Í•ÉÙ…Ñ¥½¸œ°(€€€€€€€m‰…Ñ¡%°Á…å±½…‘¥•ÍÑt°(€€€€€€¤ì(€€€€€½¹ÍÐÙ…±Õ”€ôÉ•ÍÕ±Ð¹É½ÝÍlÁtü¹½‰Í•ÉÙ…Ñ¥½¸ì(€€€€€¥˜€ (€€€€€€€€…½‰©•Ð¡Ù…±Õ”¤ñð(€€€€€€€Ù…±Õ”¹‰…Ñ¡%€„ôô‰…Ñ¡%ñð(€€€€€€€Ù…±Õ”¹Á…å±½…‘¥•ÍÐ€„ôôÁ…å±½…‘¥•ÍÐñð(€€€€€€€€…l¹½Ñ}…ÁÁ±¥•œ°€½µµ¥ÑÑ•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡Ù…±Õ”¹ÍÑ…Ñ”¤¤(€€€€€€¤(€€€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œ…Ì½¹ÍÐ°É••¥ÁÐè¹Õ±°ôì(€€€€€½¹ÍÐÉ••¥ÁÐ€ô(€€€€€€€Ù…±Õ”¹ÍÑ…Ñ”€ôôô€½µµ¥ÑÑ•œ(€€€€€€€€€€ü…Ñ…±½Õ•Må¹I••¥ÁÐ¡Ù…±Õ”¹É••¥ÁÐ°‰…Ñ¡%¤(€€€€€€€€€€è¹Õ±°ì(€€€€€¥˜€¡Ù…±Õ”¹ÍÑ…Ñ”€ôôô€½µµ¥ÑÑ•œ€˜˜€…É••¥ÁÐ¤(€€€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œ…Ì½¹ÍÐ°É••¥ÁÐè¹Õ±°ôì(€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”èÙ…±Õ”¹ÍÑ…Ñ”…Ì€¹½Ñ}…ÁÁ±¥•œð€½µµ¥ÑÑ•œ°É••¥ÁÐôì(€€€ô…Ñ ì(€€€€€É•ÑÕÉ¸ìÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œ…Ì½¹ÍÐ°É••¥ÁÐè¹Õ±°ôì(€€€ô(€ô((€ÁÉ¥Ù…Ñ”…Íå¹ŒÉ•½É (€€€…Ñ½É%èÍÑÉ¥¹œ°(€€€‰…Ñ¡%èÍÑÉ¥¹œ°(€€€‰…Ñ¡¥•ÍÐèÍÑÉ¥¹œ°(€€€•áÁ•Ñ•‘MÑ…Ñ”è€•á•ÕÑ¥¹œœð€Õ¹•ÉÑ…¥¸œ°(€€€ÍÑ…Ñ”è€Õ¹•ÉÑ…¥¸œð€½µµ¥ÑÑ•œð€™…¥±•œ°(€€€É••¥ÁÐè…Ñ…±½Õ•Må¹I••¥ÁÐð¹Õ±°°(€€€•ÉÉ½Èè€¹½Ñ}…ÁÁ±¥•œð€Ñ…É•Ñ}É•©•Ñ•œð¹Õ±°°(€€¤ì(€€€…Ý…¥Ð…ÕÑ¡…¥±ÕÉ”¡Ñ¡¥Ì¹…ÕÑ °…Ñ½É%¤ì(€€€½¹ÍÐÍ½ÕÉ”€ô…Ý…¥ÐÑ¡¥Ì¹Á½½±Ì¹Í½ÕÉ” ¤ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÍ½ÕÉ”¹ÅÕ•Éä (€€€€€€€€M1P¹½Ù±•…É¹}…‘µ¥¹}ÁÉ¥Ù…Ñ”¹É•½É‘}…Ñ…±½Õ•}Íå¹}‰…Ñ  ÄèéÕÕ¥°ÈèéÕÕ¥°ÌèéÑ•áÐ°ÐèéÑ•áÐ°ÔèéÑ•áÐ°Øèé©Í½¹ˆ°ÜèéÑ•áÐ¤L½Á•É…Ñ¥½¹Ìœ°(€€€€€€€l(€€€€€€€€€…Ñ½É%°(€€€€€€€€€‰…Ñ¡%°(€€€€€€€€€‰…Ñ¡¥•ÍÐ°(€€€€€€€€€•áÁ•Ñ•‘MÑ…Ñ”°(€€€€€€€€€ÍÑ…Ñ”°(€€€€€€€€€É••¥ÁÐ€ü)M=8¹ÍÑÉ¥¹¥™ä¡É••¥ÁÐ¤€è¹Õ±°°(€€€€€€€€€•ÉÉ½È°(€€€€€€€t°(€€€€€€¤ì(€€€€€½¹ÍÐ½Á•É…Ñ¥½¹Ì€ôÉ•ÍÕ±Ð¹É½ÝÍlÁtü¹½Á•É…Ñ¥½¹Ìì(€€€€€¥˜€ (€€€€€€€€…ÉÉ…ä¹¥ÍÉÉ…ä¡½Á•É…Ñ¥½¹Ì¤ñð(€€€€€€€½Á•É…Ñ¥½¹Ì¹±•¹Ñ €ð€Äñð(€€€€€€€½Á•É…Ñ¥½¹Ì¹±•¹Ñ €ø€ÄÀÀñð(€€€€€€€½Á•É…Ñ¥½¹Ì¹Í½µ” (€€€€€€€€€€¡¥Ñ•´¤€ôø€……Í=Á•É…Ñ¥½¸¡¥Ñ•´¤ñð…Í=Á•É…Ñ¥½¸¡¥Ñ•´¤ü¹ÍÑ…Ñ”€„ôôÍÑ…Ñ”°(€€€€€€€€¤(€€€€€€¤(€€€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È Õ¹…Ù…¥±…‰±”œ¤ì(€€€€€É•ÑÕÉ¸½Á•É…Ñ¥½¹Ìì(€€€ô…Ñ €¡™…¥±ÕÉ”¤ì(€€€€€¥˜€¡™…¥±ÕÉ”¥¹ÍÑ…¹•½˜…Ñ…±½Õ•Må¹ÉÉ½È¤Ñ¡É½Ü™…¥±ÕÉ”ì(€€€€€½¹ÍÐ½‘”€ô•ÉÉ½É½‘”¡™…¥±ÕÉ”¤ì(€€€€€Ñ¡É½Ü¹•Ü…Ñ…±½Õ•Må¹ÉÉ½È (€€€€€€€½‘”€ôôô€œÐÀÀÀÄœ€ü€½¹™±¥Ðœ€è€Õ¹…Ù…¥±…‰±”œ°(€€€€€€€½‘”°(€€€€€€¤ì(€€€ô™¥¹…±±äì(€€€€€Í½ÕÉ”¹É•±•…Í” ¤ì(€€€ô(€ô)ô()…Íå¹Œ™Õ¹Ñ¥½¸…Ñ…±½Õ•Må¹Q…É•ÑI•…‘ä (€Á½½±ÌèI•ÑÕÉ¹QåÁ”ñÑåÁ•½˜É•…Ñ•AÕ‰±¥…Ñ¥½¹AA½½±Ìø°(¤ì(€±•ÐÑ…É•ÐèAÕ‰±¥…Ñ¥½¹½¹¹•Ñ¥½¸ðÕ¹‘•™¥¹•ì(€ÑÉäì(€€€Ñ…É•Ð€ô…Ý…¥ÐÁ½½±Ì¹Ñ…É•Ð ¤ì(€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÑ…É•Ð¹ÅÕ•Éä (€€€€€€M1P¹½Ù±•…É¹}…‘µ¥¹}ÁÉ¥Ù…Ñ”¹…Ñ…±½Õ•}Íå¹}Ñ…É•Ñ}½¹ÑÉ…Ð ¤L½¹ÑÉ…Ðœ°(€€€€¤ì(€€€É•ÑÕÉ¸É•ÍÕ±Ð¹É½ÝÍlÁtü¹½¹ÑÉ…Ð€ôôô€…Ñ½µ¥Œµ…Ñ…±½Õ”µÑ…É•ÐµØÄœì(€ô…Ñ ì(€€€É•ÑÕÉ¸™…±Í”ì(€ô™¥¹…±±äì(€€€Ñ…É•Ðü¹É•±•…Í” ¤ì(€ô)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸…Ñ…±½Õ•Må¹Q…É•ÑÙ…¥±…‰±” (€½¹™¥œè…Ñ…±½Õ•Må¹½¹™¥ÕÉ…Ñ¥½¸°(¤ì(€½¹ÍÐÁ½½±Ì€ôÉ•…Ñ•AÕ‰±¥…Ñ¥½¹AA½½±Ì¡½¹™¥œ¤ì(€ÑÉäì(€€€É•ÑÕÉ¸…Ý…¥Ð…Ñ…±½Õ•Må¹Q…É•ÑI•…‘ä¡Á½½±Ì¤ì(€ô™¥¹…±±äì(€€€…Ý…¥ÐÁ½½±Ì¹±½Í” ¤¹…Ñ   ¤€ôøÕ¹‘•™¥¹•¤ì(€ô)ô(