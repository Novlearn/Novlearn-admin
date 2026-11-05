import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { engineFailure, runEngine } from '@/lib/engine-runtime';
import { isEngineEnabled } from '@/lib/engine-identity';
import type { JsonObject, JsonValue } from 'novlearn-exercise-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config || !isEngineEnabled(process.env))
    return json({ error: 'Validation Engine non activ�e.' }, 503);
  if (!isTrustedMutation(request, config))
    return json({ error: 'Origine refus�e.' }, 403);
  const { gateway, response } = createRouteAuth(request, config);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { error: 'Acc�s refus�.' },
      access.reason === 'unauthenticated'
        ? 401
        : access.reason === 'forbidden'
          ? 403
          : 503,
    );
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return finish({ error: 'Format JSON requis.' }, 415);
  let input: unknown;
  try {
    input = await readBoundedJson(request);
  } catch {
    return finish({ error: 'Requ�te invalide ou trop volumineuse.' }, 400);
  }
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== 'definition') ||
    !Object.hasOwn(input, 'definition')
  )
    return finish({ error: 'Requ�te invalide.' }, 400);
  try {
    const value = await runEngine(
      'validateDefinition',
      { definition: (input as JsonObject).definition as JsonValue },
      request.signal,
    );
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.ok !== 'boolean'
    )
      throw new Error('Engine protocol');
    if (
      !value.ok &&
      (!Array.isArray(value.diagnostics) ||
        value.diagnostics.length === 0 ||
        value.diagnostics.some(
          (item) =>
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item) ||
            typeof item.path !== 'string' ||
            typeof item.code !== 'string' ||
            typeof item.message !== 'string',
        ))
    )
      throw new Error('Engine diagnostics protocol');
    // Success returns no private definition/expected answers, just schema validity.
    return finish({
      environment: 'staging',
      valid: value.ok,
      diagnostics: value.ok ? [] : value.diagnostics,
    });
  } catch (error) {
    const failure = engineFailure(error);
    return finish(
      {
        code: failure.code,
        error: `${failure.message} Le brouillon reste conserv�.`,
      },
      failure.status,
    );
  }
}

