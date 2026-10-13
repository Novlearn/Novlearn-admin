import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/ssr', () => ({ createServerClient: sdk.create }));

import { middleware } from '@/middleware';

beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'synthetic-review');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test_value',
  );
  vi.stubEnv('APP_BASE_URL', 'https://admin.example.test');
  sdk.create.mockReset();
});

describe('renouvellement de session SSR', () => {
  it('transmet les cookies renouvelés au rendu serveur et au navigateur', async () => {
    sdk.create.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll(
            [
              {
                name: 'sb-session',
                value: 'new-token',
                options: { httpOnly: true, secure: true, path: '/' },
              },
            ],
            { 'Cache-Control': 'private, no-store' },
          );
          return { data: { user: null }, error: null };
        },
      },
    }));
    const request = new NextRequest('https://admin.example.test/admin', {
      headers: { cookie: 'sb-session=old-token' },
    });
    const response = await middleware(request);
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'sb-session=new-token',
    );
    expect(response.cookies.get('sb-session')?.value).toBe('new-token');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('ne contacte pas Auth quand le verrou est fermé', async () => {
    vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'false');
    const response = await middleware(
      new NextRequest('https://admin.example.test/admin'),
    );
    expect(sdk.create).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
