// Cloudflare Pages Function: proxies /internal/* -> fanstack.io/api/links/api/v1/*
// Forwards the user-supplied JWT (X-Fs-Token header) as Authorization: Bearer <token>.
// The JWT lives only on the request path (never stored server-side).

const UPSTREAM = 'https://fanstack.io/api';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Fs-Token',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const token = request.headers.get('X-Fs-Token');
  if (!token) {
    return json({ error: 'missing_token' }, 401);
  }

  const upstreamPath = url.pathname.replace(/^\/internal/, '');
  const upstreamUrl = UPSTREAM + upstreamPath + url.search;

  const init = {
    method: request.method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json',
    },
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
    init.headers['Content-Type'] = request.headers.get('Content-Type') || 'application/json';
  }

  const upstreamRes = await fetch(upstreamUrl, init);
  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
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
