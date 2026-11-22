const ORIGIN = 'https://dksbluesky.github.io';
function reply(status, body, origin) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  if (status === 204) { headers['Access-Control-Allow-Methods'] = 'GET, PUT, OPTIONS'; headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'; }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}
function allowed(request, env) {
  const origin = request.headers.get('Origin');
  return origin === ORIGIN || (env.DEV_ORIGIN && origin === env.DEV_ORIGIN) ? origin : null;
}
async function accountId(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '');
  if (!match) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function valid(records) {
  return Array.isArray(records) && records.length <= 5000 && records.every(r => r && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && ['startSoc', 'endSoc', 'odometer', 'kwh', 'totalCost'].every(k => typeof r[k] === 'number' && Number.isFinite(r[k])));
}
export async function handleRequest(request, env) {
  const origin = allowed(request, env);
  if (request.headers.get('Origin') && !origin) return reply(403, { error: 'Origin denied' }, null);
  if (request.method === 'OPTIONS') return reply(204, null, origin);
  if (new URL(request.url).pathname !== '/v1/records') return reply(404, { error: 'Not found' }, origin);
  const account = await accountId(request);
  if (!account) return reply(401, { error: 'Pairing key required' }, origin);
  if (!env.DB) return reply(503, { error: 'Database unavailable' }, origin);
  try {
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT records_json, revision FROM charging_sync WHERE account_id = ?').bind(account).first();
      return row ? reply(200, { records: JSON.parse(row.records_json), revision: row.revision }, origin) : reply(404, { error: 'No cloud data' }, origin);
    }
    if (request.method !== 'PUT') return reply(405, { error: 'Method not allowed' }, origin);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 250000) return reply(413, { error: 'Too large' }, origin);
    const body = JSON.parse(raw);
    if (!Number.isInteger(body.revision) || body.revision < 0 || !valid(body.records)) return reply(400, { error: 'Invalid payload' }, origin);
    const data = JSON.stringify(body.records);
    if (body.revision === 0) {
      const result = await env.DB.prepare('INSERT OR IGNORE INTO charging_sync (account_id, records_json, revision) VALUES (?, ?, 1)').bind(account, data).run();
      return result.meta.changes ? reply(200, { revision: 1 }, origin) : reply(409, { error: 'Cloud changed' }, origin);
    }
    const result = await env.DB.prepare('UPDATE charging_sync SET records_json = ?, revision = revision + 1 WHERE account_id = ? AND revision = ?').bind(data, account, body.revision).run();
    return result.meta.changes ? reply(200, { revision: body.revision + 1 }, origin) : reply(409, { error: 'Cloud changed' }, origin);
  } catch (_error) { return reply(503, { error: 'Sync unavailable' }, origin); }
}
export default { fetch: handleRequest };
