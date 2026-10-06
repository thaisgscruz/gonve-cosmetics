import { get, put } from '@vercel/blob';

const PATH = 'gonve/catalog.json';

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const received = req.headers['x-admin-password'] || '';
  return Boolean(expected) && received === expected;
}

async function readCatalog() {
  try {
    const result = await get(PATH, { access: 'private', useCache: false });
    if (!result || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (error) {
    if (String(error?.message || error).includes('404')) return null;
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const data = await readCatalog();
      return res.status(200).json(data || {});
    } catch (error) {
      console.error('catalog GET error', error);
      return res.status(500).json({ error: 'catalog_read_failed' });
    }
  }

  if (req.method === 'POST') {
    if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PUT') {
    if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.products)) {
        return res.status(400).json({ error: 'invalid_catalog' });
      }
      await put(PATH, JSON.stringify(body), {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json'
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('catalog PUT error', error);
      return res.status(500).json({ error: 'catalog_write_failed' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
