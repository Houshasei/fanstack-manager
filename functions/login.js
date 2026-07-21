// Cloudflare Pages Function: proxies fanstack.io login.
// Client sends { identifier, password }. Server-to-server call to
// https://fanstack.io/api/control-plane/auth/login. On success we return
// { sessionToken, refreshToken } — the refresh token is parsed out of the
// upstream Set-Cookie header so the client can store it for auto-refresh.
// The password is never persisted anywhere; it's only in memory for this request.

const UPSTREAM = 'https://fanstack.io/api/control-plane/auth/login';

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
  const identifier = body?.identifier || body?.email || body?.username;
  const password = body?.password;
  if (!identifier || !password) return json({ error: 'missing_credentials' }, 400);

  const upstreamRes = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
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

  // Parse the rotated refresh token from Set-Cookie.
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
    refreshToken: newRefresh,
    // Also expose orgId for convenience (helps skip a whoami call)
    organizationId: data?.session?.actor?.organizationId || data?.session?.organization?.organizationId || null,
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
