import type { AuthConfiguration } from './config';

export function isTrustedMutation(
  request: Request,
  config: AuthConfiguration,
): boolean {
  return (
    request.method === 'POST' &&
    request.headers.get('origin') === config.appOrigin
  );
}

export function privateHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
  });
}

export async function readBoundedForm(
  request: Request,
): Promise<URLSearchParams | null> {
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return new URLSearchParams(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
