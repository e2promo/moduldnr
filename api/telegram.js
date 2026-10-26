// Vercel Serverless Function: /api/telegram
// Токен бота и chat_id — только из env (TG_BOT_TOKEN, TG_CHAT_ID); из браузера не принимаются.

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const TOKEN = (process.env.TG_BOT_TOKEN || '').trim();
  const CHAT = (process.env.TG_CHAT_ID || '').trim();
  if (!TOKEN || !CHAT) return res.status(500).json({ error: 'Server has no TG token/chat configured' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const p = body.payload || {};
  const phone = clip(p.phone, 40);
  if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Missing payload.phone' });

  const name = clip(p.name, 200), model = clip(p.model, 200), comment = clip(p.comment, 1500);
  const page = clip(body.page || p.page, 300);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  const lines = ['🔔 Новая заявка с сайта Модуль ДНР', '━━━━━━━━━━━━━━━━━━━━'];
  if (name) lines.push('👤 Имя: ' + esc(name));
  lines.push('📞 Телефон: ' + esc(phone));
  if (model) lines.push('🏷 Модель: ' + esc(model));
  if (comment) lines.push('💬 Комментарий: ' + esc(comment));
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  if (page) lines.push('🌐 Страница: ' + esc(page));
  lines.push('🕒 Время: ' + new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }));
  if (ip) lines.push('🖥 IP: ' + esc(ip));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) return res.status(200).json({ ok: true, message_id: d.result && d.result.message_id });
    return res.status(502).json({ error: d.description || 'HTTP ' + r.status });
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Telegram timeout' : e.message });
  } finally {
    clearTimeout(timer);
  }
};
