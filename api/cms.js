// Vercel Serverless Function: /api/cms
// Протокол тот же, что был у PHP-версии (api.js не менялся).
//   GET  ?type=content|media|products|gallery|requests|contacts
//   POST { action, type, data }
// Env: SUPABASE_URL, SUPABASE_KEY, ADMIN_TOKEN, (опц.) ADMIN_LOGIN

const crypto = require('crypto');
const db = require('./_db');

const PUBLIC_GET = ['content', 'media', 'products', 'gallery'];
const ADMIN_GET = ['requests', 'contacts'];
const MAX_LEN = 5000;

function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isAdmin(req) {
  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return false; // fail closed: без ADMIN_TOKEN запись/чтение заявок закрыты
  const h = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return h !== '' && safeEq(h, token);
}

const str = (v, n = MAX_LEN) => String(v == null ? '' : v).slice(0, n);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    // ------------------------------------------------------------ GET
    if (req.method === 'GET') {
      const type = String(req.query.type || '');
      if (!type) return res.status(400).json({ error: 'Missing type' });
      if (ADMIN_GET.includes(type) && !isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      if (![...PUBLIC_GET, ...ADMIN_GET].includes(type)) return res.status(400).json({ error: 'Unknown type' });

      const order = ['gallery', 'requests', 'contacts'].includes(type) ? 'created_at.desc' : type === 'products' ? 'id' : '';
      const rows = await db.select(type, order);

      if (type === 'content') {
        const o = {}; rows.forEach((r) => { o[r.key] = r.value; });
        return res.status(200).json(o);
      }
      if (type === 'media') {
        const o = {}; rows.forEach((r) => { o[r.key] = { dataUrl: r.data_url, fileName: r.file_name }; });
        return res.status(200).json(o);
      }
      return res.status(200).json(rows);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ------------------------------------------------------------ POST
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, type } = body;
    const data = body.data || {};
    if (!action || !type) return res.status(400).json({ error: 'Missing action or type' });

    // Публичные действия: отправка заявки и проверка пароля админки
    if (action === 'login') {
      const token = process.env.ADMIN_TOKEN || '';
      if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN не задан на сервере' });
      const wantLogin = process.env.ADMIN_LOGIN || 'admin'; // по умолчанию — прежний логин
      const okLogin = safeEq(str(data.login, 200), wantLogin);
      const okPass = safeEq(str(data.password, 500), token);
      if (!okLogin || !okPass) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'addRequest') {
      const phone = str(data.phone, 40).trim();
      if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Invalid phone' });
      const ins = await db.insert('requests', {
        name: str(data.name, 200), phone,
        model: str(data.model, 200), comment: str(data.comment, 2000), status: 'new',
      }, true);
      return res.status(200).json({ ok: true, id: ins && ins[0] ? ins[0].id : null });
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'saveContent':
        for (const [k, v] of Object.entries(data)) {
          if (k.length > 120 || (typeof v === 'object' && v !== null)) continue;
          await db.upsert('content', { key: k, value: String(v) }, 'key');
        }
        return res.status(200).json({ ok: true });

      case 'saveMedia': {
        const key = str(data.key, 120).trim();
        if (!key) return res.status(400).json({ error: 'Missing key' });
        await db.upsert('media', { key, data_url: str(data.dataUrl, 8e6), file_name: str(data.fileName, 200) }, 'key');
        return res.status(200).json({ ok: true });
      }
      case 'deleteMedia':
        if (!data.key) return res.status(400).json({ error: 'Missing key' });
        await db.remove('media', 'key', data.key);
        return res.status(200).json({ ok: true });

      case 'addProduct': {
        const p = data.product;
        if (!p || !p.id) return res.status(400).json({ error: 'Missing product id' });
        await db.upsert('products', {
          id: str(p.id, 120), title: str(p.title, 300), dims: str(p.dims, 100),
          area: Number.isFinite(+p.area) ? +p.area : 0, price: Number.isFinite(+p.price) ? +p.price : 0,
          tag: str(p.tag, 100), img: str(p.img, 8e6),
        }, 'id');
        return res.status(200).json({ ok: true });
      }
      case 'deleteProduct':
        if (!data.id) return res.status(400).json({ error: 'Missing id' });
        await db.remove('products', 'id', data.id);
        return res.status(200).json({ ok: true });

      case 'addGalleryItem':
        await db.insert('gallery', { data_url: str(data.dataUrl, 8e6), file_name: str(data.fileName, 200) });
        return res.status(200).json({ ok: true });
      case 'deleteGalleryItem':
        if (!data.id) return res.status(400).json({ error: 'Missing id' });
        await db.remove('gallery', 'id', data.id);
        return res.status(200).json({ ok: true });

      case 'updateRequest':
        if (!data.id) return res.status(400).json({ error: 'Missing id' });
        await db.update('requests', 'id', data.id, { status: str(data.status || 'new', 30) });
        return res.status(200).json({ ok: true });
      case 'deleteRequest':
        if (!data.id) return res.status(400).json({ error: 'Missing id' });
        await db.remove('requests', 'id', data.id);
        return res.status(200).json({ ok: true });

      case 'addContact':
        await db.insert('contacts', {
          name: str(data.name, 200), phone: str(data.phone, 40), telegram: str(data.telegram, 120),
          vk: str(data.vk, 200), source: str(data.source || 'API', 100),
        });
        return res.status(200).json({ ok: true });
      case 'deleteContact':
        if (!data.id) return res.status(400).json({ error: 'Missing id' });
        await db.remove('contacts', 'id', data.id);
        return res.status(200).json({ ok: true });

      default:
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }
  } catch (e) {
    console.error('[api/cms]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
