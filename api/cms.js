// API-эндпоинт: /api/cms
// GET /api/cms?type=content  — получить данные
// POST /api/cms — сохранить/удалить данные (body: { action, type, data })
//
// Защита (опциональная): если в env задан ADMIN_TOKEN, то записи и чтения
// requests/contacts требуют заголовок Authorization: Bearer <ADMIN_TOKEN>.
// Если ADMIN_TOKEN не задан — доступ открыт (удобно для быстрого старта).

import { supabase } from './_supabase.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const PUBLIC_GET = ['content', 'media', 'products', 'gallery'];
const ADMIN_GET = ['requests', 'contacts'];
const PUBLIC_ACTIONS = ['addRequest'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Если ADMIN_TOKEN не задан в env — проверка отключена
function isAdmin(req) {
  if (!ADMIN_TOKEN) return true;
  const auth = req.headers.authorization || '';
  return auth === 'Bearer ' + ADMIN_TOKEN;
}

async function handleGet(req, res) {
  const type = req.query.type;
  if (!type) return res.status(400).json({ error: 'Missing type' });

  if (ADMIN_GET.includes(type) && !isAdmin(req))
    return res.status(401).json({ error: 'Unauthorized' });
  if (![...PUBLIC_GET, ...ADMIN_GET].includes(type))
    return res.status(400).json({ error: 'Unknown type' });

  // Таблицы content/media/products не имеют created_at
  const hasCreatedAt = ['gallery', 'requests', 'contacts'].includes(type);
  let query = supabase.from(type).select('*');
  if (hasCreatedAt) query = query.order('created_at', { ascending: false });
  else if (type === 'products') query = query.order('id');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  if (type === 'content') {
    const obj = {}; (data || []).forEach(r => { obj[r.key] = r.value; });
    return res.json(obj);
  }
  if (type === 'media') {
    const obj = {}; (data || []).forEach(r => { obj[r.key] = { dataUrl: r.data_url, fileName: r.file_name }; });
    return res.json(obj);
  }
  return res.json(data || []);
}

async function handlePost(req, res) {
  const { action, type, data } = req.body || {};
  if (!action || !type) return res.status(400).json({ error: 'Missing action or type' });

  // Заявку с формы сайта может отправить любой посетитель
  if (!PUBLIC_ACTIONS.includes(action) && !isAdmin(req))
    return res.status(401).json({ error: 'Unauthorized' });

  switch (action) {
    case 'saveContent': {
      const promises = Object.entries(data || {}).map(([key, value]) =>
        supabase.from('content').upsert({ key, value }, { onConflict: 'key' }));
      await Promise.all(promises);
      return res.json({ ok: true });
    }
    case 'saveMedia': {
      const { key, dataUrl, fileName } = data || {};
      if (!key) return res.status(400).json({ error: 'Missing key' });
      await supabase.from('media').upsert({ key, data_url: dataUrl || '', file_name: fileName || '' }, { onConflict: 'key' });
      return res.json({ ok: true });
    }
    case 'deleteMedia': {
      const key = data?.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      await supabase.from('media').delete().eq('key', key);
      return res.json({ ok: true });
    }
    case 'addProduct': {
      if (!data?.product?.id) return res.status(400).json({ error: 'Missing product id' });
      await supabase.from('products').upsert(data.product);
      return res.json({ ok: true });
    }
    case 'deleteProduct': {
      if (!data?.id) return res.status(400).json({ error: 'Missing id' });
      await supabase.from('products').delete().eq('id', data.id);
      return res.json({ ok: true });
    }
    case 'addGalleryItem': {
      const { dataUrl, fileName } = data || {};
      await supabase.from('gallery').insert({ data_url: dataUrl || '', file_name: fileName || '' });
      return res.json({ ok: true });
    }
    case 'deleteGalleryItem': {
      if (!data?.id) return res.status(400).json({ error: 'Missing id' });
      await supabase.from('gallery').delete().eq('id', data.id);
      return res.json({ ok: true });
    }
    case 'addRequest': {
      const { name, phone, model, comment } = data || {};
      const { data: ins } = await supabase.from('requests').insert({ name, phone, model, comment, status: 'new' }).select();
      return res.json({ ok: true, id: ins?.[0]?.id });
    }
    case 'updateRequest': {
      if (!data?.id) return res.status(400).json({ error: 'Missing id' });
      await supabase.from('requests').update({ status: data.status }).eq('id', data.id);
      return res.json({ ok: true });
    }
    case 'deleteRequest': {
      if (!data?.id) return res.status(400).json({ error: 'Missing id' });
      await supabase.from('requests').delete().eq('id', data.id);
      return res.json({ ok: true });
    }
    case 'addContact': {
      const { name, phone, telegram, vk, source } = data || {};
      await supabase.from('contacts').insert({ name, phone, telegram, vk, source: source || 'API' });
      return res.json({ ok: true });
    }
    case 'deleteContact': {
      if (!data?.id) return res.status(400).json({ error: 'Missing id' });
      await supabase.from('contacts').delete().eq('id', data.id);
      return res.json({ ok: true });
    }
    default:
      return res.status(400).json({ error: 'Unknown action: ' + action });
  }
}