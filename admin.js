/* =====================================================================
   Модуль ДНР — Админ-панель (CRM)
   ===================================================================== */

const AUTH_KEY = 'modul_dnr_auth';
const REQUESTS_KEY = 'modul_dnr_requests';
const CONTACTS_KEY = 'modul_dnr_contacts';
const USERS = [{ login: 'admin', pass: 'admin123' }]; // {{уточнить_у_заказчика}}: заменить на secure auth

/* ---------- Авторизация ---------- */
function isLoggedIn(){ return sessionStorage.getItem(AUTH_KEY) === '1'; }

function showLogin(){
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}
function showDashboard(){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'grid';
  syncFromApi().finally(() => renderAll());
}

/* Синхронизация: API → localStorage (кэш) */
async function syncFromApi(){
  if(!window.API) return;

  // Заявки и контакты — главное, что должно приходить с сервера
  try {
    const reqs = await API.getRequests();
    if(Array.isArray(reqs)){
      const normalized = reqs.map(r => ({
        id: String(r.id),
        date: r.created_at || r.date || '',
        name: r.name || '',
        phone: r.phone || '',
        model: r.model || '',
        comment: r.comment || '',
        status: r.status || 'new'
      }));
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(normalized));
    }
  } catch(e){ console.warn('sync requests skipped:', e); }

  try {
    const cts = await API.getContacts();
    if(Array.isArray(cts)){
      const normalized = cts.map(c => ({
        id: String(c.id),
        date: c.created_at || c.date || '',
        name: c.name || '',
        phone: c.phone || '',
        telegram: c.telegram || '',
        vk: c.vk || '',
        source: c.source || ''
      }));
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(normalized));
    }
  } catch(e){ console.warn('sync contacts skipped:', e); }

  try {
    const [content, media] = await Promise.all([API.getContent(), API.getMedia()]);
    if(content && Object.keys(content).length) localStorage.setItem('modul_dnr_content', JSON.stringify(content));
    if(media && Object.keys(media).length) localStorage.setItem('modul_dnr_media', JSON.stringify(media));
  } catch(e){ console.warn('sync content/media skipped:', e); }
  try {
    const products = await API.getProducts();
    const custom = (products || []).filter(p => p.id && p.id.startsWith('custom_'));
    if(custom.length) localStorage.setItem('modul_dnr_custom_products', JSON.stringify(custom));
  } catch(e){ console.warn('sync products skipped:', e); }
  try {
    const gallery = await API.getGallery();
    if(gallery && gallery.length){
      const mapped = gallery.map(g => ({ id: g.id, dataUrl: g.data_url, fileName: g.file_name }));
      localStorage.setItem('modul_dnr_custom_gallery', JSON.stringify(mapped));
    }
  } catch(e){ console.warn('sync gallery skipped:', e); }
}

/* Ручное обновление данных */
async function refreshData(btn){
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Загрузка...'; }
  await syncFromApi();
  renderAll();
  if(btn){ btn.disabled = false; btn.textContent = '🔄 Обновить'; }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  const ok = USERS.some(u => u.login === user && u.pass === pass);
  if(ok){
    sessionStorage.setItem(AUTH_KEY, '1');
    showDashboard();
  } else {
    err.textContent = 'Неверный логин или пароль';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
});

document.getElementById('refresh-btn')?.addEventListener('click', (e) => {
  refreshData(e.currentTarget);
});

/* ---------- Данные ---------- */
function getRequests(){ return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]'); }
function saveRequests(arr){ localStorage.setItem(REQUESTS_KEY, JSON.stringify(arr)); }
function getContacts(){ return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
function saveContacts(arr){ localStorage.setItem(CONTACTS_KEY, JSON.stringify(arr)); }
function getContent(){ return JSON.parse(localStorage.getItem(CONTENT_KEY) || '{}'); }
function saveContent(obj){
  localStorage.setItem(CONTENT_KEY, JSON.stringify(obj));
  if(window.API) API.saveContent(obj).catch(e => console.warn('API saveContent:', e));
}
function getMedia(){ return JSON.parse(localStorage.getItem(MEDIA_KEY) || '{}'); }
function saveMedia(obj){
  localStorage.setItem(MEDIA_KEY, JSON.stringify(obj));
  if(!window.API) return;
  // Раскладываем вложенную структуру в плоские ключи для БД
  const flat = {};
  if(obj.hero) flat['hero'] = obj.hero;
  if(obj.logo) flat['logo'] = obj.logo;
  Object.entries(obj.catalog || {}).forEach(([id, v]) => { flat['catalog_' + id] = v; });
  (obj.gallery || []).forEach((v, i) => { if(v) flat['gallery_' + i] = v; });
  Object.entries(flat).forEach(([key, val]) => {
    if(val && val.dataUrl) API.saveMedia(key, val.dataUrl, val.fileName || '').catch(() => {});
  });
}
function getCustomProducts(){ return JSON.parse(localStorage.getItem(CUSTOM_PRODUCTS_KEY) || '[]'); }
function saveCustomProducts(arr){
  localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(arr));
  if(window.API) arr.forEach(p => API.addProduct(p).catch(() => {}));
}
function getCustomGallery(){ return JSON.parse(localStorage.getItem(CUSTOM_GALLERY_KEY) || '[]'); }
function saveCustomGallery(arr){
  localStorage.setItem(CUSTOM_GALLERY_KEY, JSON.stringify(arr));
}

/* ---------- Форматирование ---------- */
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}
function fmtPhone(p){ return p || '—'; }
function statusLabel(s){
  const map = { new:'Новая', processing:'В обработке', done:'Завершена', rejected:'Отклонена' };
  return map[s] || s;
}
function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ---------- Табы ---------- */
const tabBtns = document.querySelectorAll('.sidebar__link');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const titles = { requests:'Заявки', contacts:'Контакты', stats:'Статистика', content:'Редактор контента', media:'Медиатека' };

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const tab = btn.dataset.tab;
    tabContents.forEach(tc => tc.classList.remove('is-active'));
    document.getElementById('tab-' + tab).classList.add('is-active');
    pageTitle.textContent = titles[tab] || tab;
    renderAll();
    if(tab === 'content') renderContentEditor();
    if(tab === 'media') renderMediaEditor();
  });
});

/* ---------- Рендер заявок ---------- */
function renderRequests(){
  const body = document.getElementById('requests-body');
  const empty = document.getElementById('empty-requests');
  const statusFilter = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  let items = getRequests();

  if(statusFilter !== 'all') items = items.filter(r => r.status === statusFilter);
  if(search) items = items.filter(r =>
    (r.name||'').toLowerCase().includes(search) ||
    (r.phone||'').includes(search) ||
    (r.model||'').toLowerCase().includes(search) ||
    (r.comment||'').toLowerCase().includes(search)
  );

  document.getElementById('items-count').textContent = items.length + ' из ' + getRequests().length;

  if(!items.length){
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = items.map(r => `
    <tr class="${r.status === 'new' ? 'is-new' : ''}">
      <td class="td-date">${String(r.id).slice(-6).toUpperCase()}</td>
      <td class="td-date">${fmtDate(r.date)}</td>
      <td class="td-name">${esc(r.name || 'Без имени')}</td>
      <td class="td-phone"><a href="tel:${r.phone}">${fmtPhone(r.phone)}</a></td>
      <td>${esc(r.model || '—')}</td>
      <td>${esc(r.comment || '—')}</td>
      <td><span class="status status--${r.status}">${statusLabel(r.status)}</span></td>
      <td class="actions">
        <button class="btn btn--ghost btn--sm" onclick="viewRequest('${r.id}')">👁</button>
        <button class="btn btn--ghost btn--sm" onclick="deleteRequest('${r.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ---------- Рендер контактов ---------- */
function renderContacts(){
  const body = document.getElementById('contacts-body');
  const empty = document.getElementById('empty-contacts');
  const search = document.getElementById('filter-contact').value.toLowerCase();
  let items = getContacts();

  if(search) items = items.filter(c =>
    (c.name||'').toLowerCase().includes(search) ||
    (c.phone||'').includes(search) ||
    (c.telegram||'').toLowerCase().includes(search) ||
    (c.vk||'').toLowerCase().includes(search)
  );

  if(!items.length){
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = items.map(c => `
    <tr>
      <td class="td-date">${String(c.id).slice(-6).toUpperCase()}</td>
      <td class="td-date">${fmtDate(c.date)}</td>
      <td class="td-name">${esc(c.name || 'Без имени')}</td>
      <td class="td-phone"><a href="tel:${c.phone}">${fmtPhone(c.phone)}</a></td>
      <td>${c.telegram ? '<a href="https://t.me/' + esc(c.telegram) + '" target="_blank">@' + esc(c.telegram) + '</a>' : '—'}</td>
      <td>${c.vk ? '<a href="' + esc(c.vk) + '" target="_blank">VK</a>' : '—'}</td>
      <td>${esc(c.source || '—')}</td>
      <td class="actions">
        <button class="btn btn--ghost btn--sm" onclick="deleteContact('${c.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ---------- Статистика ---------- */
function renderStats(){
  const reqs = getRequests();
  const contacts = getContacts();
  const today = new Date().toISOString().slice(0,10);

  document.getElementById('stat-total').textContent = reqs.length;
  document.getElementById('stat-new').textContent = reqs.filter(r => r.status === 'new').length;
  document.getElementById('stat-processing').textContent = reqs.filter(r => r.status === 'processing').length;
  document.getElementById('stat-done').textContent = reqs.filter(r => r.status === 'done').length;
  document.getElementById('stat-contacts').textContent = contacts.length;
  document.getElementById('stat-today').textContent = reqs.filter(r => r.date && r.date.startsWith(today)).length;
}

/* ---------- Рендер всех ---------- */
function renderAll(){
  renderRequests();
  renderContacts();
  renderStats();
}

/* ---------- Просмотр заявки ---------- */
window.viewRequest = function(id){
  const reqs = getRequests();
  const r = reqs.find(x => String(x.id) === String(id));
  if(!r) return;

  document.getElementById('modal-title').textContent = 'Заявка #' + String(r.id).slice(-6).toUpperCase();
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-detail">
      <div class="modal-detail__label">Дата</div>
      <div class="modal-detail__val">${fmtDate(r.date)}</div>
    </div>
    <div class="modal-detail">
      <div class="modal-detail__label">Имя</div>
      <div class="modal-detail__val">${esc(r.name || 'Без имени')}</div>
    </div>
    <div class="modal-detail">
      <div class="modal-detail__label">Телефон</div>
      <div class="modal-detail__val"><a href="tel:${r.phone}">${fmtPhone(r.phone)}</a></div>
    </div>
    <div class="modal-detail">
      <div class="modal-detail__label">Модель</div>
      <div class="modal-detail__val">${esc(r.model || '—')}</div>
    </div>
    <div class="modal-detail">
      <div class="modal-detail__label">Комментарий</div>
      <div class="modal-detail__val">${esc(r.comment || '—')}</div>
    </div>
    <div class="modal-detail">
      <div class="modal-detail__label">Статус</div>
      <div class="modal-detail__val">
        <select id="modal-status" class="field" style="width:auto; padding:8px 12px;">
          <option value="new" ${r.status==='new'?'selected':''}>Новая</option>
          <option value="processing" ${r.status==='processing'?'selected':''}>В обработке</option>
          <option value="done" ${r.status==='done'?'selected':''}>Завершена</option>
          <option value="rejected" ${r.status==='rejected'?'selected':''}>Отклонена</option>
        </select>
      </div>
    </div>
  `;

  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal-save').onclick = () => {
    const newStatus = document.getElementById('modal-status').value;
    const idx = reqs.findIndex(x => String(x.id) === String(id));
    if(idx >= 0){
      reqs[idx].status = newStatus;
      saveRequests(reqs);
      renderAll();
    }
    if(window.API) API.updateRequest(id, newStatus).catch(e => console.warn('API updateRequest:', e));
    closeModal();
  };
};

/* ---------- Удаление ---------- */
window.deleteRequest = function(id){
  if(!confirm('Удалить заявку?')) return;
  const reqs = getRequests().filter(r => String(r.id) !== String(id));
  saveRequests(reqs);
  renderAll();
  if(window.API) API.deleteRequest(id).catch(e => console.warn('API deleteRequest:', e));
};

window.deleteContact = function(id){
  if(!confirm('Удалить контакт?')) return;
  const contacts = getContacts().filter(c => String(c.id) !== String(id));
  saveContacts(contacts);
  renderAll();
  if(window.API) API.deleteContact(id).catch(e => console.warn('API deleteContact:', e));
};

/* ---------- Модалка ---------- */
function closeModal(){ document.getElementById('modal').style.display = 'none'; }
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', closeModal);

/* ---------- Экспорт CSV ---------- */
document.getElementById('export-btn').addEventListener('click', () => {
  const reqs = getRequests();
  if(!reqs.length){ alert('Нет данных для экспорта'); return; }

  const headers = ['ID','Дата','Имя','Телефон','Модель','Комментарий','Статус'];
  const rows = reqs.map(r => [
    String(r.id).slice(-6).toUpperCase(),
    fmtDate(r.date),
    r.name || '',
    r.phone || '',
    r.model || '',
    r.comment || '',
    statusLabel(r.status)
  ]);

  const csv = [headers, ...rows].map(row => row.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modul_dnr_export_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------- Фильтры ---------- */
document.getElementById('filter-status').addEventListener('change', renderRequests);
document.getElementById('filter-search').addEventListener('input', renderRequests);
document.getElementById('filter-contact').addEventListener('input', renderContacts);

/* ---------- Утилиты ---------- */
function esc(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ---------- Добавление заявок из формы ---------- */
window.addRequest = function(data){
  const reqs = getRequests();
  reqs.unshift({
    id: genId(),
    date: new Date().toISOString(),
    name: data.name || '',
    phone: data.phone || '',
    model: data.model || '',
    comment: data.comment || '',
    status: 'new'
  });
  saveRequests(reqs);
};

/* ---------- Добавление контакта ---------- */
window.addContact = function(data){
  const contacts = getContacts();
  contacts.unshift({
    id: genId(),
    date: new Date().toISOString(),
    name: data.name || '',
    phone: data.phone || '',
    telegram: data.telegram || '',
    vk: data.vk || '',
    source: data.source || 'Сайт'
  });
  saveContacts(contacts);
};

/* ---------- Инициализация ---------- */
if(isLoggedIn()){
  showDashboard();
} else {
  showLogin();
}

/* ---------- Мобильное меню ---------- */
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
sidebarToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('is-open');
});
document.querySelector('.main')?.addEventListener('click', (e) => {
  if(sidebar.classList.contains('is-open') && !e.target.closest('.sidebar') && !e.target.closest('#sidebar-toggle')){
    sidebar.classList.remove('is-open');
  }
});

/* =====================================================================
   Редактор контента
   ===================================================================== */
const CONTENT_KEY = 'modul_dnr_content';
const MEDIA_KEY = 'modul_dnr_media';
const CUSTOM_PRODUCTS_KEY = 'modul_dnr_custom_products';
const CUSTOM_GALLERY_KEY = 'modul_dnr_custom_gallery';

const CATALOG_PRODUCTS = [
  {id:'coffee', title:'Кофейня', dims:'1,8×1,6×2,7', area:'2,9', price:'220 000 ₽'},
  {id:'tp', title:'Торговый павильон (Т.П.)', dims:'4×2,5×2,7', area:'10', price:'350 000 ₽'},
  {id:'m6-25', title:'Модуль 6×2,5', dims:'6×2,5×2,7', area:'15', price:'450 000 ₽'},
  {id:'m6-3', title:'Модуль 6×3', dims:'6×3×2,7', area:'18', price:'550 000 ₽'},
  {id:'m7-3', title:'Модуль 7×3', dims:'7×3×2,7', area:'21', price:'650 000 ₽'},
  {id:'m8-3', title:'Модуль 8×3', dims:'8×3×2,7', area:'24', price:'700 000 ₽'},
  {id:'m10-3', title:'Модуль 10×3', dims:'10×3×2,7', area:'30', price:'1 100 000 ₽'},
  {id:'m6-5', title:'Модуль 6×5', dims:'6×5×2,7', area:'30', price:'1 100 000 ₽'},
  {id:'lux', title:'Вагон-бытовка «Люкс»', dims:'6×2,5×2,7', area:'15', price:'270 000 ₽'},
  {id:'dacha', title:'Вагон-бытовка «Дачная»', dims:'6×2,5×2,7', area:'15', price:'250 000 ₽'}
];

const DEFAULT_CONTENT = {
  'hero.badge': 'Собственное производство модульных конструкций',
  'hero.title': 'Готовые коммерческие пространства — ',
  'hero.titleWood': 'без строительства и долгого ремонта',
  'hero.subtitle': 'Большое остекление, внутренняя отделка, освещение и электрические розетки — можно использовать под бизнес практически сразу.',
  'hero.usecases': '🔥 Подойдет для: магазина, кофейни, офиса, пункта выдачи, салона, мастерской или торговой точки.',
  'produce.title': 'Что мы производим',
  'produce.lead': 'Модульные конструкции для торговли, услуг и бытовых задач.',
  'produce.card1.title': 'Кофейни',
  'produce.card1.text': 'Компактные модули для кофе-точек с окном выдачи.',
  'produce.card2.title': 'Торговые павильоны',
  'produce.card2.text': 'Павильоны с вариантом входа или окна выдачи.',
  'produce.card3.title': 'Модульные здания',
  'produce.card3.text': 'Модули разных размеров под любую модель и задачу.',
  'produce.card4.title': 'Вагоны-бытовки',
  'produce.card4.text': 'Серии «Люкс» (ЛДСП) и «Дачная» (ОСБ).',
  'catalog.title': 'Каталог и цены',
  'cta.title': 'Не нашли подходящий размер?',
  'cta.text': 'Изготавливаем по индивидуальным вариантам исполнения. Опишите задачу — рассчитаем.',
  'why.title': 'Почему выбирают нас',
  'why.lead': 'Только то, что подтверждается ассортиментом и прайсом.',
  'why.card1.title': 'Прозрачные цены',
  'why.card1.text': 'Стоимость моделей опубликована в каталоге — без скрытых наценок в базовой комплектации.',
  'why.card2.title': 'Линейка типоразмеров',
  'why.card2.text': 'От компактной кофейни 1,8×1,6 м до модуля 10×3 м — под разные задачи.',
  'why.card3.title': 'Индивидуальное исполнение',
  'why.card3.text': 'Вариант входа или окна выдачи, отделка ЛДСП или ОСБ в бытовках.',
  'why.card4.title': 'Связь в один клик',
  'why.card4.text': 'Быстрый ответ и расчёт через Telegram и VK.',
  'gallery.title': 'Наши работы',
  'gallery.lead': 'Реальные фотографии продукции. Нажмите на фото для увеличения.',
  'how.title': 'Как заказать',
  'how.lead': 'Типовой сценарий работы.',
  'how.step1.title': 'Выбор модели',
  'how.step1.text': 'Определяемся с размером и назначением.',
  'how.step2.title': 'Комплектация',
  'how.step2.text': 'Уточняем вход/окно выдачи и отделку.',
  'how.step3.title': 'Расчёт',
  'how.step3.text': 'Считаем итоговую стоимость под задачу.',
  'how.step4.title': 'Согласование',
  'how.step4.text': 'Подтверждаем детали заказа.',
  'how.step5.title': 'Изготовление и получение',
  'how.step5.text': 'Производим и передаём изделие.',
  'lead.title': 'Получить расчёт',
  'lead.text': 'Оставьте заявку — вернёмся с расчётом. Или напишите нам напрямую.',
  'footer.desc': 'Производство модульных павильонов, кофеен, модульных зданий и вагонов-бытовок.'
};

function getContentValue(key){
  const c = getContent();
  return c.hasOwnProperty(key) ? c[key] : DEFAULT_CONTENT[key] || '';
}

/* ---------- Форма редактора контента ---------- */
const CONTENT_GROUPS = [
  {label:'Первый экран', keys:['hero.badge','hero.title','hero.titleWood','hero.subtitle','hero.usecases']},
  {label:'Что производим', keys:['produce.title','produce.lead','produce.card1.title','produce.card1.text','produce.card2.title','produce.card2.text','produce.card3.title','produce.card3.text','produce.card4.title','produce.card4.text']},
  {label:'Каталог и цены', keys:['catalog.title']},
  {label:'CTA-блок', keys:['cta.title','cta.text']},
  {label:'Почему выбирают нас', keys:['why.title','why.lead','why.card1.title','why.card1.text','why.card2.title','why.card2.text','why.card3.title','why.card3.text','why.card4.title','why.card4.text']},
  {label:'Галерея', keys:['gallery.title','gallery.lead']},
  {label:'Как заказать', keys:['how.title','how.lead','how.step1.title','how.step1.text','how.step2.title','how.step2.text','how.step3.title','how.step3.text','how.step4.title','how.step4.text','how.step5.title','how.step5.text']},
  {label:'Форма заявки', keys:['lead.title','lead.text']},
  {label:'Футер', keys:['footer.desc']}
];

function renderContentEditor(){
  const editor = document.getElementById('content-editor');
  if(!editor || editor.dataset.inited) return;
  editor.dataset.inited = '1';

  editor.innerHTML = CONTENT_GROUPS.map(g => {
    const fields = g.keys.map(k => {
      const val = getContentValue(k);
      const isMultiline = k.includes('subtitle') || k.includes('usecases') || k.includes('text') || k.includes('desc');
      const rows = k.includes('usecases') ? 3 : 2;
      if(isMultiline){
        return `<div class="editor-field"><label>${labelName(k)}</label><textarea data-key="${k}" rows="${rows}">${esc(val)}</textarea></div>`;
      }
      return `<div class="editor-field"><label>${labelName(k)}</label><input type="text" data-key="${k}" value="${esc(val)}" /></div>`;
    }).join('');
    return `<div class="editor-group"><div class="editor-group__head">${esc(g.label)}</div><div class="editor-group__body">${fields}</div></div>`;
  }).join('');
}

function labelName(k){
  const map = {
    'hero.badge':'Бейдж', 'hero.title':'Заголовок (часть 1)', 'hero.titleWood':'Заголовок (акцент, деревянный цвет)',
    'hero.subtitle':'Подзаголовок', 'hero.usecases':'Варианты использования',
    'produce.title':'Заголовок секции', 'produce.lead':'Описание',
    'produce.card1.title':'Карточка 1 — заголовок', 'produce.card1.text':'Карточка 1 — текст',
    'produce.card2.title':'Карточка 2 — заголовок', 'produce.card2.text':'Карточка 2 — текст',
    'produce.card3.title':'Карточка 3 — заголовок', 'produce.card3.text':'Карточка 3 — текст',
    'produce.card4.title':'Карточка 4 — заголовок', 'produce.card4.text':'Карточка 4 — текст',
    'catalog.title':'Заголовок', 'cta.title':'Заголовок', 'cta.text':'Текст',
    'why.title':'Заголовок секции', 'why.lead':'Описание',
    'why.card1.title':'Карточка 1 — заголовок', 'why.card1.text':'Карточка 1 — текст',
    'why.card2.title':'Карточка 2 — заголовок', 'why.card2.text':'Карточка 2 — текст',
    'why.card3.title':'Карточка 3 — заголовок', 'why.card3.text':'Карточка 3 — текст',
    'why.card4.title':'Карточка 4 — заголовок', 'why.card4.text':'Карточка 4 — текст',
    'gallery.title':'Заголовок', 'gallery.lead':'Описание',
    'how.title':'Заголовок секции', 'how.lead':'Описание',
    'how.step1.title':'Шаг 1 — заголовок', 'how.step1.text':'Шаг 1 — текст',
    'how.step2.title':'Шаг 2 — заголовок', 'how.step2.text':'Шаг 2 — текст',
    'how.step3.title':'Шаг 3 — заголовок', 'how.step3.text':'Шаг 3 — текст',
    'how.step4.title':'Шаг 4 — заголовок', 'how.step4.text':'Шаг 4 — текст',
    'how.step5.title':'Шаг 5 — заголовок', 'how.step5.text':'Шаг 5 — текст',
    'lead.title':'Заголовок', 'lead.text':'Текст',
    'footer.desc':'Описание'
  };
  return map[k] || k;
}

document.getElementById('content-save')?.addEventListener('click', () => {
  const status = document.getElementById('content-status');
  const data = {};
  document.querySelectorAll('#content-editor [data-key]').forEach(el => {
    const v = el.value.trim();
    if(v && v !== DEFAULT_CONTENT[el.dataset.key]) data[el.dataset.key] = v;
  });
  saveContent(data);
  status.textContent = '✅ Контент сохранён!';
  status.classList.add('is-ok');
  setTimeout(() => { status.textContent = ''; status.classList.remove('is-ok'); }, 3000);
});

/* ---------- Редактор медиа ---------- */
function renderMediaEditor(){
  const editor = document.getElementById('media-editor');
  if(!editor || editor.dataset.inited) return;
  editor.dataset.inited = '1';
  const media = getMedia();
  const customProducts = getCustomProducts();
  const customGallery = getCustomGallery();

  let html = '<div class="media-grid">';

  // Hero
  html += mediaCard('hero', 'Фон первого экрана', media.hero, 'Баннер 1920×1080, jpg/png/webp', 'media-card--hero');

  // Логотип
  html += mediaCard('logo', 'Логотип', media.logo, 'Квадратная иконка, 200×200', 'media-card--logo');

  html += '</div>';

  // --- Каталог ---
  html += '<div class="media-group">';
  html += '<div class="media-group__head"><span>Каталог — позиции</span>';
  html += '<button class="btn btn--primary btn--sm" id="add-product-btn">➕ Добавить товар</button></div>';
  html += '<div class="media-grid">';
  CATALOG_PRODUCTS.forEach(p => {
    html += mediaCard('catalog_'+p.id, p.title, (media.catalog||{})[p.id], p.dims+' — '+p.price);
  });
  customProducts.forEach((p, i) => {
    const cur = p.img ? { dataUrl: p.img, fileName: p.title + '.jpg' } : null;
    html += mediaCard('cprod_'+i, '⭐ ' + p.title, cur, 'Новый товар — ' + (p.price||'цена не указана'), 'media-card--custom');
  });
  html += '</div></div>';

  // --- Галерея ---
  html += '<div class="media-group">';
  html += '<div class="media-group__head"><span>Наши работы — галерея</span>';
  html += '<button class="btn btn--primary btn--sm" id="add-gallery-btn">➕ Добавить фото</button></div>';
  html += '<div class="media-grid">';
  for(let i = 0; i < 8; i++){
    html += mediaCard('gallery_'+i, 'Галерея — фото '+(i+1), (media.gallery||[])[i], '600×600, jpg/png/webp');
  }
  customGallery.forEach((g, i) => {
    html += mediaCard('cgall_'+i, '⭐ Добавленное фото '+(i+1), g, 'Новое фото', 'media-card--custom');
  });
  html += '</div></div>';

  editor.innerHTML = html;
}

function mediaCard(key, label, current, hint, extraClass){
  const src = current ? current.dataUrl : '';
  const fileName = current ? current.fileName : '';
  const placeholder = src ? '' : `<div class="media-placeholder">${esc(hint)}</div>`;
  const img = src ? `<img src="${src}" alt="${esc(label)}" />` : '';
  return `
    <div class="media-card ${extraClass||''}" data-media-key="${key}">
      <div class="media-card__preview">${img || placeholder}</div>
      <div class="media-card__body">
        <div class="media-card__label">${esc(label)}</div>
        ${fileName ? `<div class="media-card__label" style="font-size:11px;color:var(--ink-2);font-weight:400;">${esc(fileName)}</div>` : ''}
        <div class="media-card__actions">
          <button class="btn btn--primary btn--sm media-upload" data-key="${key}">📁 Загрузить</button>
          ${src ? `<button class="btn btn--ghost btn--sm media-delete" data-key="${key}">🗑 Удалить</button>` : ''}
        </div>
        <input type="file" class="media-input" data-key="${key}" accept="image/jpeg,image/png,image/webp" />
      </div>
    </div>
  `;
}

/* ---------- Загрузка/удаление медиа ---------- */
document.addEventListener('click', (e) => {
  const uploadBtn = e.target.closest('.media-upload');
  if(uploadBtn){
    const input = uploadBtn.parentElement.parentElement.querySelector('.media-input');
    if(input) input.click();
    return;
  }

  const deleteBtn = e.target.closest('.media-delete');
  if(deleteBtn){
    const key = deleteBtn.dataset.key;
    // Удаление добавленного товара / фото целиком
    if(key.startsWith('cprod_')){
      if(!confirm('Удалить этот товар из каталога?')) return;
      const idx = parseInt(key.replace('cprod_',''), 10);
      const arr = getCustomProducts();
      const removed = arr.splice(idx, 1)[0];
      saveCustomProducts(arr);
      if(window.API && removed && removed.id) API.deleteProduct(removed.id).catch(() => {});
      rerenderMediaEditor();
      return;
    }
    if(key.startsWith('cgall_')){
      if(!confirm('Удалить это фото из галереи?')) return;
      const idx = parseInt(key.replace('cgall_',''), 10);
      const arr = getCustomGallery();
      const removed = arr.splice(idx, 1)[0];
      saveCustomGallery(arr);
      if(window.API && removed && removed.id) API.deleteGalleryItem(removed.id).catch(() => {});
      rerenderMediaEditor();
      return;
    }
    const media = getMedia();
    removeMediaKey(media, key);
    saveMedia(media);
    if(window.API) API.deleteMedia(key).catch(() => {});
    updateMediaCard(key);
    showMediaStatus('🗑 Фото удалено');
  }

  // Добавление нового товара
  const addProduct = e.target.closest('#add-product-btn');
  if(addProduct){
    openAddProductModal();
    return;
  }
  // Добавление нового фото в галерею
  const addGallery = e.target.closest('#add-gallery-btn');
  if(addGallery){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.id = 'cgall-add-input';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.remove();
      if(!file) return;
      readFileResized(file, 600, (dataUrl) => {
        const arr = getCustomGallery();
        arr.push({ dataUrl, fileName: file.name });
        saveCustomGallery(arr);
        if(window.API){
          API.addGalleryItem(dataUrl, file.name)
            .then(() => syncFromApi())
            .then(() => rerenderMediaEditor())
            .catch(() => {});
        }
        rerenderMediaEditor();
        showMediaStatus('✅ Фото добавлено в галерею');
      });
    });
    input.click();
    return;
  }
});

document.addEventListener('change', (e) => {
  const input = e.target.closest('.media-input');
  if(!input || !input.files.length) return;
  const key = input.dataset.key;
  const file = input.files[0];
  if(file.size > 5 * 1024 * 1024){
    showMediaStatus('❌ Файл больше 5 МБ', true);
    input.value = '';
    return;
  }
  readFileResized(file, maxDimForKey(key), (dataUrl) => {
    if(key.startsWith('cprod_')){
      const idx = parseInt(key.replace('cprod_',''), 10);
      const arr = getCustomProducts();
      if(arr[idx]){
        arr[idx].img = dataUrl;
        saveCustomProducts(arr);
        updateMediaCard(key);
        showMediaStatus('✅ Фото загружено: ' + file.name);
      }
      return;
    }
    if(key.startsWith('cgall_')){
      const idx = parseInt(key.replace('cgall_',''), 10);
      const arr = getCustomGallery();
      if(arr[idx]){
        arr[idx].dataUrl = dataUrl;
        arr[idx].fileName = file.name;
        saveCustomGallery(arr);
        if(window.API && arr[idx].id){
          API.deleteGalleryItem(arr[idx].id)
            .then(() => API.addGalleryItem(dataUrl, file.name))
            .catch(() => {});
        }
        updateMediaCard(key);
        showMediaStatus('✅ Фото загружено: ' + file.name);
      }
      return;
    }
    const media = getMedia();
    setMediaKey(media, key, { dataUrl, fileName: file.name });
    saveMedia(media);
    updateMediaCard(key);
    showMediaStatus('✅ Фото загружено: ' + file.name);
  });
  input.value = '';
});

function readFileResized(file, maxDim, cb){
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      cb(resizeImage(img, maxDim, 0.82));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function maxDimForKey(key){
  if(key.startsWith('hero')) return 1280;
  if(key.startsWith('logo')) return 200;
  if(key.startsWith('gallery') || key.startsWith('cgall')) return 600;
  if(key.startsWith('catalog') || key.startsWith('cprod')) return 800;
  return 800;
}

function rerenderMediaEditor(){
  const editor = document.getElementById('media-editor');
  if(!editor) return;
  delete editor.dataset.inited;
  renderMediaEditor();
}

/* ---------- Модалка добавления товара ---------- */
function openAddProductModal(){
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  const saveBtn = document.getElementById('modal-save');
  const cancelBtn = document.getElementById('modal-cancel');

  title.textContent = 'Добавить товар в каталог';
  body.innerHTML = `
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Название *</label>
      <input type="text" id="np-title" placeholder="Например: Модуль 5 × 3" />
    </div>
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Размеры (Д × Ш × В, м)</label>
      <input type="text" id="np-dims" placeholder="5 × 3 × 2,7" />
    </div>
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Цена (₽)</label>
      <input type="text" id="np-price" placeholder="500 000" />
    </div>
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Площадь (м²)</label>
      <input type="text" id="np-area" placeholder="15" />
    </div>
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Метка (опционально)</label>
      <input type="text" id="np-tag" placeholder="Например: Хит" />
    </div>
    <div class="editor-field" style="margin-bottom:12px;">
      <label>Фотография</label>
      <div class="media-card" style="max-width:260px;">
        <div class="media-card__preview" id="np-preview"><div class="media-placeholder">Загрузите фото</div></div>
        <div class="media-card__body">
          <button class="btn btn--primary btn--sm" id="np-upload">📁 Выбрать фото</button>
          <input type="file" id="np-file" accept="image/jpeg,image/png,image/webp" style="display:none;" />
        </div>
      </div>
    </div>
  `;

  let imageDataUrl = '';
  document.getElementById('np-upload').addEventListener('click', () => {
    document.getElementById('np-file').click();
  });
  document.getElementById('np-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 5 * 1024 * 1024){ showMediaStatus('❌ Файл больше 5 МБ', true); return; }
    readFileResized(file, 800, (dataUrl) => {
      imageDataUrl = dataUrl;
      document.getElementById('np-preview').innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    });
  });

  cancelBtn.textContent = 'Отмена';
  saveBtn.textContent = 'Добавить';
  saveBtn.style.display = '';
  cancelBtn.style.display = '';

  // сохраняем старый onclick обработчик не трогаем — заменяем на новый
  saveBtn.onclick = () => {
    const t = document.getElementById('np-title').value.trim();
    if(!t){ showMediaStatus('❌ Укажите название товара', true); return; }
    const arr = getCustomProducts();
    arr.push({
      id: 'custom_' + Date.now().toString(36),
      title: t,
      dims: document.getElementById('np-dims').value.trim() || '—',
      area: parseFloat((document.getElementById('np-area').value || '0').replace(',','.')) || 0,
      price: (document.getElementById('np-price').value.trim() || '0').replace(/[^\d]/g,''),
      tag: document.getElementById('np-tag').value.trim(),
      img: imageDataUrl || ''
    });
    saveCustomProducts(arr);
    closeModal();
    rerenderMediaEditor();
    showMediaStatus('✅ Товар добавлен в каталог');
  };

  modal.style.display = 'flex';
}

function resizeImage(img, maxDim, quality){
  let w = img.width, h = img.height;
  if(w > maxDim || h > maxDim){
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

function setMediaKey(media, key, val){
  if(key.startsWith('catalog_') || key.startsWith('gallery_')){
    const parts = key.split('_');
    const group = parts[0] === 'catalog' ? 'catalog' : 'gallery';
    const idx = parts.slice(1).join('_');
    if(!media[group]) media[group] = {};
    media[group][idx] = val;
  } else {
    media[key] = val;
  }
}

function removeMediaKey(media, key){
  if(key.startsWith('catalog_') || key.startsWith('gallery_')){
    const parts = key.split('_');
    const group = parts[0] === 'catalog' ? 'catalog' : 'gallery';
    const idx = parts.slice(1).join('_');
    if(media[group] && media[group][idx]) delete media[group][idx];
  } else {
    delete media[key];
  }
}

function updateMediaCard(key){
  const media = getMedia();
  const card = document.querySelector(`.media-card[data-media-key="${key}"]`);
  if(!card) return;
  const preview = card.querySelector('.media-card__preview');

  let val;
  if(key.startsWith('cprod_')){
    const idx = parseInt(key.replace('cprod_',''), 10);
    const p = getCustomProducts()[idx];
    val = p && p.img ? { dataUrl: p.img, fileName: p.title + '.jpg' } : null;
  } else if(key.startsWith('cgall_')){
    const idx = parseInt(key.replace('cgall_',''), 10);
    val = getCustomGallery()[idx] || null;
  } else if(key.startsWith('catalog_')){
    const id = key.replace('catalog_','');
    val = (media.catalog||{})[id];
  } else if(key.startsWith('gallery_')){
    const idx = key.replace('gallery_','');
    val = (media.gallery||[])[idx];
  } else {
    val = media[key];
  }

  const body = card.querySelector('.media-card__body');
  const actions = body.querySelector('.media-card__actions');

  if(val && val.dataUrl){
    preview.innerHTML = `<img src="${val.dataUrl}" alt="" />`;
    if(!body.querySelector('.media-delete')){
      const del = document.createElement('button');
      del.className = 'btn btn--ghost btn--sm media-delete';
      del.dataset.key = key;
      del.textContent = '🗑 Удалить';
      actions.appendChild(del);
    }
    let nameLabel = body.querySelector('.media-card__label.file-name');
    if(!nameLabel){
      nameLabel = document.createElement('div');
      nameLabel.className = 'media-card__label';
      nameLabel.style.cssText = 'font-size:11px;color:var(--ink-2);font-weight:400;';
      body.insertBefore(nameLabel, actions);
    }
    nameLabel.textContent = val.fileName || '';
  } else {
    preview.innerHTML = '<div class="media-placeholder">Фото не загружено</div>';
    const delBtn = body.querySelector('.media-delete');
    if(delBtn) delBtn.remove();
    const nameLabel = body.querySelector('.media-card__label.file-name');
    if(nameLabel) nameLabel.remove();
  }
}

document.getElementById('media-save')?.addEventListener('click', () => {
  showMediaStatus('✅ Медиа сохранены');
});

function showMediaStatus(msg, isErr){
  const el = document.getElementById('media-status');
  if(!el) return;
  el.textContent = msg;
  el.className = 'editor-status' + (isErr ? ' is-err' : ' is-ok');
  setTimeout(() => { el.textContent = ''; el.className = 'editor-status'; }, 3000);
}
