// Vercel function: GET/PUT the one online copy of your progress (Upstash Redis).
// Saves are merged into what is stored, never replacing it, so no browser can wipe the online copy.
const crypto = require('crypto');
const { mergeData } = require('../core.js');
const KEY = 'progress:owner';
const OLD = 'progress:*'; // copies saved under sync codes before there was one shared copy
const MAX_SESSIONS = 5000;
const MAX_BYTES = 900 * 1024; // Upstash free requests stop at 1 MB
const PER_HOUR = 300;

// Pasted settings often carry stray quotes or spaces.
const env = (...names) => names.map(n => (process.env[n] || '').replace(/["'\s]/g, '')).find(Boolean);

async function redis(cmd) {
  const url = env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
  if (!token) throw new Error('storage token missing');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('storage ' + r.status);
  return (await r.json()).result;
}
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const isData = d => d && Array.isArray(d.sessions) && d.days && typeof d.days === 'object' && d.keys && typeof d.keys === 'object';
const parse = raw => { try { const d = JSON.parse(raw); return isData(d) ? d : null; } catch (e) { return null; } };

// The stored copy. The first time, it is built by combining every old sync-code copy (those stay untouched).
async function load() {
  const raw = await redis(['GET', KEY]);
  if (raw) return parse(raw);
  let all = null, cursor = '0';
  do {
    const [next, keys] = await redis(['SCAN', cursor, 'MATCH', OLD, 'COUNT', 100]);
    cursor = String(next);
    for (const k of keys) {
      if (k === KEY) continue;
      const d = parse(await redis(['GET', k]));
      if (d) all = all ? mergeData(all, d, MAX_SESSIONS) : d;
    }
  } while (cursor !== '0');
  if (all) await redis(['SET', KEY, JSON.stringify(all)]);
  return all;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL')) return res.status(503).json({ error: 'not set up' });
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'method' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
    const bucket = 'rate:' + hash(ip).slice(0, 16) + ':' + Math.floor(Date.now() / 3600000);
    const hits = await redis(['INCR', bucket]);
    if (hits === 1) await redis(['EXPIRE', bucket, 3600]);
    if (hits > PER_HOUR) return res.status(429).json({ error: 'slow down' });
    if (req.method === 'GET') return res.status(200).json({ data: await load() });
    const b = req.body;
    if (!b || b.v !== 2 || !isData(b)) return res.status(400).json({ error: 'bad data' });
    if (Buffer.byteLength(JSON.stringify(b)) > MAX_BYTES) return res.status(413).json({ error: 'too big' });
    const stored = await load();
    const raw = JSON.stringify(stored ? mergeData(stored, b, MAX_SESSIONS) : b);
    if (Buffer.byteLength(raw) > MAX_BYTES) return res.status(413).json({ error: 'too big' });
    await redis(['SET', KEY, raw]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e.message);
    return res.status(502).json({ error: /^storage /.test(e.message) ? e.message : 'storage unreachable' });
  }
};
