export const ORIGIN = 'https://gitlab.seaburymro.com';
export const segment = value => {
  const s = String(value);
  if (!s || s === '.' || s === '..') throw new Error('Invalid path segment');
  return encodeURIComponent(s);
};
export function createGitLab({ tokenProvider, fetchImpl = fetch }) {
  return async function request(method, path, query = {}, body) {
    if (!['GET', 'POST', 'PUT'].includes(method) || !path.startsWith('/') || path.includes('..') || path.includes('?') || path.includes('#')) throw new Error('Invalid API request');
    const url = new URL(`${ORIGIN}/api/v4${path}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const token = await tokenProvider();
    let response;
    try {
      response = await fetchImpl(url, {
        method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error('GitLab request failed or timed out. Check your network/VPN and TLS certificate. A write may have succeeded; inspect GitLab before retrying.'); }
    if (!response.ok) {
      const hint = ({401:'Token missing, invalid or expired.',403:'Token scope or project permissions do not allow this action.',404:'Resource not found or not visible to your account.',429:'Rate limited; wait before retrying.'})[response.status] || 'Request rejected; verify fields and current resource state.';
      throw new Error(`GitLab HTTP ${response.status}. ${hint}`);
    }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Expected GitLab JSON; received another content type.');
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) { await reader.cancel(); throw new Error('Response exceeds 2 MB; narrow the request or reduce per_page.'); }
      chunks.push(Buffer.from(value));
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('GitLab returned invalid JSON.'); }
    // Redact this connector's credential even if it is echoed in a resource.
    data = JSON.parse(JSON.stringify(data).split(token).join('[REDACTED]'));
    return { data, next_page: response.headers.get('x-next-page') || null };
  };
}
