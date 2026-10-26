// Мини-клиент Supabase (PostgREST) без зависимостей. Только на сервере.
// Env: SUPABASE_URL, SUPABASE_KEY (service_role), ADMIN_TOKEN

const TABLES = ['content', 'media', 'products', 'gallery', 'requests', 'contacts'];

function cfg() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_KEY не заданы в Vercel → Settings → Environment Variables');
  return { url, key };
}

async function rest(method, path, body, headers = {}) {
  const { url, key } = cfg();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Supabase HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const q = (v) => encodeURIComponent(String(v));

module.exports = {
  TABLES,
  select: (table, order) => rest('GET', `${table}?select=*${order ? `&order=${order}` : ''}`),
  upsert: (table, row, conflict) =>
    rest('POST', `${table}?on_conflict=${conflict}`, row, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
  insert: (table, row, returning = false) =>
    rest('POST', table, row, { Prefer: returning ? 'return=representation' : 'return=minimal' }),
  update: (table, col, val, patch) => rest('PATCH', `${table}?${col}=eq.${q(val)}`, patch, { Prefer: 'return=minimal' }),
  remove: (table, col, val) => rest('DELETE', `${table}?${col}=eq.${q(val)}`, undefined, { Prefer: 'return=minimal' }),
};
