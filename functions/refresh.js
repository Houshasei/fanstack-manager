// Cloudflare Pages Function: proxies token refresh.
// Client sends { refreshToken }. We call fanstack.io/api/control-plane/auth/refresh
// with the refresh token as a Cookie header (server-to-server, so samesite=strict
// browser rules don't apply). Returns { sessionToken, refreshToken } — the new
// rotated refresh token is parsed out of the upstream Set-Cookie header.

const UPSTREAM = 'https://fanstack.io/api/control-plane/auth/refresh';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const refreshToken = body?.refreshToken;
  if (!refreshToken) return json({ error: 'missing_refresh_token' }, 400);

  const upstreamRes = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': 'fanstack.refresh_token=' + refreshToken,
    },
    body: JSON.stringify({ refreshToken: null }),
  });

  const text = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return new Response(text || JSON.stringify({ error: 'upstream_' + upstreamRes.status }), {
      status: upstreamRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let data;
  try { data = JSON.parse(text); } catch { data = {}; }

  // Extract new refresh token from Set-Cookie response header.
  // getSetCookie() returns an array in CF workers; fall back to combined header.
  let newRefresh = null;
  const cookies = typeof upstreamRes.headers.getSetCookie === 'function'
    ? upstreamRes.headers.getSetCookie()
    : (upstreamRes.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z0-9_-]+=)/);
  for (const c of cookies) {
    const m = /fanstack\.refresh_token=([^;]+)/.exec(c);
    if (m) { newRefresh = m[1]; break; }
  }

  return json({
    sessionToken: data.sessionToken || null,
    refreshToken: newRefresh, // null if upstream didn't rotate; client should keep old one
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
