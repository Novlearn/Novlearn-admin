import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { isExerciseId, isUuid } from '@/lib/catalogue';
import {
  activeCatalogId,
  activeVersionState,
  comparableVersion,
  compareActiveVersion,
} from '@/lib/active-version';
import { readLocalActiveVersionConfiguration } from '@/lib/active-version-config';
import { loadLocalActiveVersion } from '@/lib/active-version-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const auth = readAuthConfiguration(process.env);
  if (!auth) return json({ error: 'Accès Staging non activé.' }, 503);
  const { gateway, response, client } = createRouteAuth(request, auth);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { error: 'Accès refusé.' },
      access.reason === 'unauthenticated'
        ? 401
        : access.reason === 'forbidden'
          ? 403
          : 503,
    );
  if (!readLocalActiveVersionConfiguration(process.env))
    return finish({ error: 'Lecture de la cible locale non activée.' }, 503);
  const { id } = await context.params,
    query = request.nextUrl.searchParams,
    versionId = query.get('version');
  if (
    !isExerciseId(id) ||
    [...query.keys()].some((k) => k !== 'version') ||
    query.getAll('version').length > 1 ||
    (versionId !== null && !isUuid(versionId))
  )
    return finish({ error: 'Sélection invalide.' }, 400);
  try {
    // Resolve the stable target identity from the authorized source, never a URL parameter.
    const parent = await client
      .from('exercises')
      .select('catalog_id')
      .eq('id', id)
      .maybeSingle();
    if (parent.error) throw Error('Source unavailable');
    if (!parent.data) return finish({ error: 'Exercice introuvable.' }, 404);
    if (!activeCatalogId(parent.data.catalog_id))
      return finish({ error: 'Identité de catalogue indisponible.' }, 409);
    let selected = null;
    if (versionId) {
      const version = await client
        .from('exercise_versions')
        .select(
          'revision,definition_sha256,engine_contract,generation_version,canonicalization_version',
        )
        .eq('id', versionId)
        .eq('exercise_id', id)
        .maybeSingle();
      if (version.error) throw Error('Source unavailable');
      if (!version.data) return finish({ error: 'Version introuvable.' }, 404);
      const v = version.data;
      selected = comparableVersion({
        revision: v.revision,
        definitionSha256: v.definition_sha256,
        engineContract: v.engine_contract,
        generationVersion: v.generation_version,
        canonicalizationVersion: v.canonicalization_version,
      });
      if (!selected) throw Error('Invalid source metadata');
    }
    const snapshot = await loadLocalActiveVersion(parent.data.catalog_id);
    return finish({
      snapshot,
      state: activeVersionState(snapshot),
      comparison: compareActiveVersion(snapshot, selected),
    });
  } catch {
    return finish({ error: 'Version publiée indisponible.' }, 503);
  }
}
