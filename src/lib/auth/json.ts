/** Read the actual bytes, including chunked requests; Content-Length is not trusted. */
export async function readBoundedJson(
  request: Request,
  limit = 262144,
): Promise<unknown> {
  if (!request.body) throw new Error('invalid-json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let body = '';
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('input-limit');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } finally {
    reader.releaseLock();
  }
}
