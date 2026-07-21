// Cloudflare Pages Function: proxies /api/* -> fanstack.link/api/ext/v2/*
// This bypasses browser CORS and keeps the API key transit inside your origin.

const UPSTREAM = 'https://fanstack.link/api/ext/v2';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const apiKey = request.headers.get('X-Api-Key');
  if (!apiKey) {
    return json({ error: 'missing_api_key' }, 401);
  }

  // /api/foo/bar -> /foo/bar
  const upstreamPath = url.pathname.replace(/^\/api/, '');
  const upstreamUrl = UPSTREAM + upstreamPath + url.search;

  const init = {
    method: request.method,
    headers: {
      'X-Api-Key': apiKey,
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
