// Vercel function: GET/PUT one person's progress, identified by a secret sync code.
// Needs an Upstash Redis store connected to the project (Vercel sets the env vars).
const crypto = require('crypto');
const MAX_BYTES = 900 * 1024; // Upstash free requests stop at 1 MB
const TTL = 400 * 86400; // seconds; renewed on every save
const PER_HOUR = 300;

// Pasted settings often carry stray quotes or spaces.
const env = (...names) => names.map(n => (process.env[n] || "").replace(/["'\s]/g, "")).find(Boolean);

async function redis(cmd) {
  const url = env("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
  if (!token) throw new Error("storage token missing");
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('storage ' + r.status);
  return (await r.json()).result;
}
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!env("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL")) return res.status(503).json({ error: 'not set up' });
  const m = /^Bearer ([a-z2-7]{26})$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'bad code' });
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'method' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
    const bucket = 'rate:' + hash(ip).slice(0, 16) + ':' + Math.floor(Date.now() / 3600000);
    const hits = await redis(['INCR', bucket]);
    if (hits === 1) await redis(['EXPIRE', bucket, 3600]);
    if (hits > PER_HOUR) return res.status(429).json({ error: 'slow down' });
    const key = 'progress:' + hash(m[1]); // the code itself is never stored
    if (req.method === 'GET') {
      const raw = await redis(['GET', key]);
      return res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    }
    const b = req.body;
    if (!b || b.v !== 2 || !Array.isArray(b.sessions) || !b.days || !b.keys) return res.status(400).json({ error: 'bad data' });
    const raw = JSON.stringify(b);
    if (Buffer.byteLength(raw) > MAX_BYTES) return res.status(413).json({ error: 'too big' });
    await redis(['SET', key, raw, 'EX', TTL]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e.message);
    return res.status(502).json({ error: /^storage /.test(e.message) ? e.message : 'storage unreachable' });
  }
};
