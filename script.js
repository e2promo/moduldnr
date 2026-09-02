/* =====================================================================
   Модуль ДНР — логика сайта
   - рендер каталога, сравнения, галереи
   - lightbox
   - форма: валидация + состояния (idle/loading/ok/error)
   - аналитика кликов (Telegram, VK, телефон, форма)
   - мобильное меню
   ===================================================================== */

/* ---------- Данные каталога (из прайса заказчика) ---------- */
const PRODUCTS = [
  { id:'coffee',   title:'Кофейня',              dims:'1,8 × 1,6 × 2,7', area:2.9,  price:220000, tag:'Хит', feat:'Компактный модуль с окном выдачи', img:'assets/img/catalog/coffee.jpg' },
  { id:'tp',       title:'Торговый павильон (Т.П.)', dims:'4 × 2,5 × 2,7', area:10, price:350000, tag:'', feat:'Вариант входа или окна выдачи — без разницы в цене', img:'assets/img/catalog/tp.jpg' },
  { id:'m6-25',    title:'Модуль 6 × 2,5',       dims:'6 × 2,5 × 2,7',   area:15,   price:450000, tag:'', feat:'Любая модель', img:'assets/img/catalog/m6-25.jpg' },
  { id:'m6-3',     title:'Модуль 6 × 3',         dims:'6 × 3 × 2,7',     area:18,   price:550000, tag:'', feat:'Любая модель', img:'assets/img/catalog/m6-3.jpg' },
  { id:'m7-3',     title:'Модуль 7 × 3',         dims:'7 × 3 × 2,7',     area:21,   price:650000, tag:'', feat:'', img:'assets/img/catalog/m7-3.jpg' },
  { id:'m8-3',     title:'Модуль 8 × 3',         dims:'8 × 3 × 2,7',     area:24,   price:700000, tag:'', feat:'', img:'assets/img/catalog/m8-3.jpg' },
  { id:'m10-3',    title:'Модуль 10 × 3',        dims:'10 × 3 × 2,7',    area:30,   price:1100000, tag:'Макс. площадь', feat:'', img:'assets/img/catalog/m10-3.jpg' },
  { id:'m6-5',     title:'Модуль 6 × 5',         dims:'6 × 5 × 2,7',     area:30,   price:1100000, tag:'', feat:'', img:'assets/img/catalog/m6-5.jpg' },
  { id:'lux',      title:'Вагон-бытовка «Люкс»', dims:'6 × 2,5 × 2,7',   area:15,   price:270000, tag:'', feat:'Внутренняя отделка: ЛДСП', img:'assets/img/catalog/lux.jpg' },
  { id:'dacha',    title:'Вагон-бытовка «Дачная»', dims:'6 × 2,5 × 2,7', area:15,  price:250000, tag:'', feat:'Внутренняя отделка: ОСБ', img:'assets/img/catalog/dacha.jpg' },
];

const fmtPrice = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

/* ---------- Аналитика ---------- */
function track(event, params = {}){
  // Google Analytics 4
  if (typeof window.gtag === 'function') window.gtag('event', event, params);
  // Яндекс.Метрика  ({{уточнить_у_заказчика}}: подставить ID счётчика)
  if (typeof window.ym === 'function' && window.YM_ID) window.ym(window.YM_ID, 'reachGoal', event, params);
  // Фолбэк для отладки
  if (!window.gtag && !window.ym) console.debug('[track]', event, params);
}

/* Делегированный трекинг по data-analytics */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-analytics]');
  if (el) track(el.getAttribute('data-analytics'), { label: el.textContent.trim().slice(0, 40) });
});

/* ---------- Рендер каталога ---------- */
function getAllProducts(){
  const custom = window.__customProducts || [];
  return PRODUCTS.concat(custom.map(p => ({
    id: p.id,
    title: p.title,
    dims: p.dims || '—',
    area: p.area || 0,
    price: parseInt((p.price || '0').replace(/[^\d]/g,''), 10) || 0,
    tag: p.tag || '',
    feat: '',
    img: p.img || ''
  })));
}

function renderCatalog(){
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  const mediaCatalog = window.__mediaCatalog || {};
  grid.innerHTML = getAllProducts().map(p => {
    const photos = p.photos || [p.img];
    const override = mediaCatalog[p.id];
    const imgSrc = (override && override.dataUrl) ? override.dataUrl : p.img.replace(/\.(jpg|jpeg)$/i, '.webp');
    const fallback = p.img;
    return `
    <article class="card">
      <div class="card__media js-popup-gallery" data-product='${JSON.stringify({title:p.title,dims:p.dims,area:p.area,price:p.price})}' data-photos='${JSON.stringify(photos.map(s => s.replace(/\.(jpg|jpeg)$/i, '.webp')))}'>
        ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ''}
        <img src="${imgSrc}" alt="${p.title} — модульное строительство Донецк | Модуль ДНР" loading="lazy" width="400" height="250"
             onerror="this.onerror=null;this.src='${fallback}';" />
        <div class="card__zoom-hint">🔍 Нажмите для просмотра</div>
      </div>
      <div class="card__body">
        <h3 class="card__title">${p.title}</h3>
        <div class="card__dims">${p.dims} м</div>
        <div class="card__price-row">
          <span class="card__price">${p.price ? fmtPrice(p.price) : 'По запросу'}</span>
          <span class="card__area">${p.area ? p.area + ' м²' : ''}</span>
        </div>
        <button type="button" class="btn btn--primary js-order" data-model="${p.title} (${p.dims} м)" data-analytics="card_order">
          Рассчитать
        </button>
      </div>
    </article>
    `;
  }).join('');
}

/* Обработчик popup gallery для каталога */
document.addEventListener('click', (e) => {
  const card = e.target.closest('.js-popup-gallery');
  if(card && !e.target.closest('.js-order')){
    try {
      const product = JSON.parse(card.dataset.product);
      const photos = JSON.parse(card.dataset.photos);
      popupGallery.open(product, photos);
    } catch(err){ console.error('Popup gallery error:', err); }
  }
});

/* ---------- Рендер галереи ---------- */
const GALLERY = Array.from({ length: 8 }, (_, i) => `assets/img/gallery/photo-${i + 1}.jpg`);
function renderGallery(){
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  const mediaGallery = window.__mediaGallery || [];
  const customGallery = window.__customGallery || [];

  let html = GALLERY.map((src, i) => {
    const webp = src.replace(/\.(jpg|jpeg)$/i, '.webp');
    const override = mediaGallery[i];
    const imgSrc = (override && override.dataUrl) ? override.dataUrl : webp;
    return `
    <figure class="gallery__item js-photo" data-full="${webp}">
      <img src="${imgSrc}" alt="Пример модульной конструкции Модуль ДНР — фото ${i + 1}" loading="lazy" width="300" height="300"
           onerror="this.onerror=null;this.src='${src}';" />
    </figure>
    `;
  }).join('');

  // Добавленные фото
  html += customGallery.map((g, i) => {
    const src = (g && g.dataUrl) ? g.dataUrl : '';
    return `
    <figure class="gallery__item js-photo" data-full="${src}">
      <img src="${src}" alt="Работа Модуль ДНР — фото ${i + 9}" loading="lazy" width="300" height="300" />
    </figure>
    `;
  }).join('');

  grid.innerHTML = html;
}

/* ---------- Заполнение select моделей ---------- */
function fillModelSelect(rebuild){
  const sel = document.getElementById('f-model');
  if (!sel) return;
  if (rebuild) {
    sel.innerHTML = '<option value="">— выберите модель —</option>';
  }
  getAllProducts().forEach(p => {
    const val = `${p.title} (${p.dims} м)`;
    if (Array.from(sel.options).some(o => o.value === val)) return;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = p.price ? `${p.title} — ${p.dims} м — ${fmtPrice(p.price)}` : `${p.title} — ${p.dims} м`;
    sel.appendChild(opt);
  });
  if (!Array.from(sel.options).some(o => o.value === 'Индивидуальный вариант')) {
    const other = document.createElement('option');
    other.value = 'Индивидуальный вариант';
    other.textContent = 'Индивидуальный вариант';
    sel.appendChild(other);
  }
}

/* ---------- Кнопки "Рассчитать" → форма ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.js-order');
  if (!btn) return;
  const model = btn.getAttribute('data-model');
  const sel = document.getElementById('f-model');
  if (sel && model) {
    let exists = Array.from(sel.options).some(o => o.value === model);
    if (!exists) { const o = document.createElement('option'); o.value = model; o.textContent = model; sel.appendChild(o); }
    sel.value = model;
  }
  document.getElementById('lead').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.getElementById('f-phone')?.focus(), 500);
});

/* ---------- Lightbox ---------- */
const lb = {
  el: document.getElementById('lightbox'),
  img: document.getElementById('lightbox-img'),
  list: [], index: 0,
  open(list, i){ this.list = list; this.index = i; this.show(); this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; },
  close(){ this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden','true'); document.body.style.overflow=''; },
  show(){ this.img.src = this.list[this.index]; this.img.alt = 'Фото модульной конструкции ' + (this.index + 1); },
  next(){ this.index = (this.index + 1) % this.list.length; this.show(); },
  prev(){ this.index = (this.index - 1 + this.list.length) % this.list.length; this.show(); },
};

document.addEventListener('click', (e) => {
  const photo = e.target.closest('.js-photo');
  if (photo && !photo.classList.contains('is-empty')) {
    const all = Array.from(document.querySelectorAll('.js-photo')).filter(p => !p.classList.contains('is-empty'));
    const list = all.map(p => p.getAttribute('data-full'));
    const idx = all.indexOf(photo);
    lb.open(list, idx < 0 ? 0 : idx);
    track('photo_open', { src: photo.getAttribute('data-full') });
  }
});
document.getElementById('lightbox-close')?.addEventListener('click', () => lb.close());
document.getElementById('lb-next')?.addEventListener('click', () => lb.next());
document.getElementById('lb-prev')?.addEventListener('click', () => lb.prev());
lb.el?.addEventListener('click', (e) => { if (e.target === lb.el) lb.close(); });
document.addEventListener('keydown', (e) => {
  if (!lb.el?.classList.contains('is-open')) return;
  if (e.key === 'Escape') lb.close();
  if (e.key === 'ArrowRight') lb.next();
  if (e.key === 'ArrowLeft') lb.prev();
});

/* ---------- Popup Gallery ---------- */
const popupGallery = {
  el: document.getElementById('popup-gallery'),
  img: document.getElementById('popup-img'),
  title: document.getElementById('popup-title'),
  thumbs: document.getElementById('popup-thumbs'),
  info: document.getElementById('popup-info'),
  list: [],
  current: 0,
  productName: '',

  open(product, photos){
    this.productName = product.title;
    this.list = photos.filter(p => p);
    this.current = 0;
    this.title.textContent = product.title;
    this.renderThumbs();
    this.show();
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    track('popup_gallery_open', { product: product.title });
  },

  close(){
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  },

  show(){
    const src = this.list[this.current];
    this.img.src = src;
    this.img.alt = this.productName + ' — фото ' + (this.current + 1);
    this.img.onerror = function(){ this.style.display='none'; };
    this.img.onload = function(){ this.style.display='block'; };
    this.updateThumbs();
    this.updateInfo();
  },

  next(){ this.current = (this.current + 1) % this.list.length; this.show(); },
  prev(){ this.current = (this.current - 1 + this.list.length) % this.list.length; this.show(); },

  renderThumbs(){
    this.thumbs.innerHTML = this.list.map((src, i) => `
      <div class="popup-gallery__thumb ${i === 0 ? 'is-active' : ''}" data-idx="${i}">
        <img src="${src}" alt="Фото ${i + 1}" loading="lazy" />
      </div>
    `).join('');
  },

  updateThumbs(){
    this.thumbs.querySelectorAll('.popup-gallery__thumb').forEach((t, i) => {
      t.classList.toggle('is-active', i === this.current);
    });
  },

  updateInfo(){
    const product = PRODUCTS.find(p => p.title === this.productName);
    if(product){
      this.info.innerHTML = `
        <span>${product.dims} м · ${product.area} м²</span>
        <span class="popup-gallery__info-price">${fmtPrice(product.price)}</span>
      `;
    }
  }
};

/* Обработчики popup gallery */
document.getElementById('popup-close')?.addEventListener('click', () => popupGallery.close());
document.getElementById('popup-overlay')?.addEventListener('click', () => popupGallery.close());
document.getElementById('popup-next')?.addEventListener('click', () => popupGallery.next());
document.getElementById('popup-prev')?.addEventListener('click', () => popupGallery.prev());

popupGallery.thumbs?.addEventListener('click', (e) => {
  const thumb = e.target.closest('.popup-gallery__thumb');
  if(thumb){
    popupGallery.current = parseInt(thumb.dataset.idx);
    popupGallery.show();
  }
});

document.addEventListener('keydown', (e) => {
  if(!popupGallery.el?.classList.contains('is-open')) return;
  if(e.key === 'Escape') popupGallery.close();
  if(e.key === 'ArrowRight') popupGallery.next();
  if(e.key === 'ArrowLeft') popupGallery.prev();
});

/* ---------- Форма: валидация + состояния ---------- */
function validatePhone(v){
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

const form = document.getElementById('lead-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phoneField = document.getElementById('f-phone');
  const phoneWrap = phoneField.closest('.field');
  const errEl = document.querySelector('[data-error-for="phone"]');
  const status = document.getElementById('form-status');
  const submit = document.getElementById('lead-submit');
  const consent = document.getElementById('f-consent');

  // сброс
  phoneWrap.classList.remove('is-invalid'); errEl.textContent=''; status.textContent=''; status.className='form-status';

  // валидация
  if (!validatePhone(phoneField.value)) {
    phoneWrap.classList.add('is-invalid');
    errEl.textContent = 'Укажите корректный номер телефона';
    phoneField.focus();
    return;
  }
  if (!consent.checked) {
    status.textContent = 'Необходимо согласие на обработку персональных данных.';
    status.classList.add('is-err');
    return;
  }

  // состояние: отправка
  submit.classList.add('is-loading');
  submit.textContent = 'Отправляем';
  status.textContent = '';

  const payload = {
    name: document.getElementById('f-name').value.trim(),
    phone: phoneField.value.trim(),
    model: document.getElementById('f-model').value,
    comment: document.getElementById('f-comment').value.trim(),
  };

  try {
    const ENDPOINT = form.dataset.endpoint || '';
    if (ENDPOINT) {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('bad status ' + res.status);
    } else if (window.API) {
      // Отправляем заявку в Supabase через серверный API
      await window.API.addRequest(payload);
    } else {
      // Фолбэк: сохраняем в localStorage для админ-панели
      const REQUESTS_KEY = 'modul_dnr_requests';
      const reqs = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
      reqs.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        date: new Date().toISOString(),
        name: payload.name,
        phone: payload.phone,
        model: payload.model,
        comment: payload.comment,
        status: 'new'
      });
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(reqs));
      await new Promise(r => setTimeout(r, 600));
    }

    // состояние: успех
    submit.classList.remove('is-loading');
    submit.textContent = 'Отправить заявку';
    form.reset();
    status.textContent = 'Заявка отправлена. Мы свяжемся с вами.';
    status.classList.add('is-ok');
    track('form_success', { model: payload.model });
  } catch (err) {
    // состояние: ошибка
    submit.classList.remove('is-loading');
    submit.textContent = 'Отправить заявку';
    status.textContent = 'Не удалось отправить. Напишите нам в Telegram или позвоните.';
    status.classList.add('is-err');
    track('form_error', { message: String(err).slice(0, 80) });
  }
});

/* ---------- Мобильное меню ---------- */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
nav?.querySelectorAll('.nav__link').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('is-open'); burger.classList.remove('is-open'); burger.setAttribute('aria-expanded','false');
}));

/* ---------- Применение контента и медиа из админ-панели ---------- */
function applyContentAndMedia(){
  try {
    const content = JSON.parse(localStorage.getItem('modul_dnr_content') || '{}');
    const media = JSON.parse(localStorage.getItem('modul_dnr_media') || '{}');

    // Тексты
    Object.keys(content).forEach(key => {
      const el = document.querySelector(`[data-edit="${key}"]`);
      if(!el) return;
      const val = content[key];
      if(key === 'hero.title'){
        // заголовок с деревянным акцентом: храним две части
        const woodEl = el.querySelector('.text-wood');
        const rest = val.trim();
        if(woodEl){
          const parts = rest.split('—');
          if(parts.length > 1){
            el.innerHTML = '';
            el.appendChild(document.createTextNode(parts[0].trim() + ' — '));
            const span = document.createElement('span');
            span.className = 'text-wood';
            span.textContent = parts.slice(1).join('—').trim();
            el.appendChild(span);
          } else {
            el.innerHTML = '';
            el.appendChild(document.createTextNode(rest));
          }
        } else {
          el.textContent = rest;
        }
      } else {
        el.textContent = val;
      }
    });

    // Медиа: hero
    if(media.hero && media.hero.dataUrl){
      const heroImg = document.querySelector('.hero__bg img');
      if(heroImg){
        heroImg.src = media.hero.dataUrl;
        heroImg.removeAttribute('srcset');
        heroImg.removeAttribute('sizes');
      }
    }
    // Логотип
    if(media.logo && media.logo.dataUrl){
      document.querySelectorAll('.logo__mark').forEach(m => {
        m.textContent = '';
        const img = document.createElement('img');
        img.src = media.logo.dataUrl;
        img.alt = 'Логотип Модуль ДНР';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
        m.appendChild(img);
      });
    }
    // Медиа: каталог — замена картинок после рендера
    window.__mediaCatalog = media.catalog || {};
    window.__mediaGallery = media.gallery || [];
    if(media.gallery && media.gallery.length){
      window.__mediaGallery = media.gallery;
    }
    // Кастомные добавленные товары и фото
    window.__customProducts = JSON.parse(localStorage.getItem('modul_dnr_custom_products') || '[]');
    window.__customGallery = JSON.parse(localStorage.getItem('modul_dnr_custom_gallery') || '[]');
  } catch(e){
    console.warn('applyContentAndMedia:', e);
  }
}

/* ---------- Догрузка контента и медиа из Supabase (через /api/cms) ---------- */
function loadFromApi(){
  if(!window.API) return;

  window.API.getContent().then(content => {
    if(!content || !Object.keys(content).length) return;
    localStorage.setItem('modul_dnr_content', JSON.stringify(content));
    Object.keys(content).forEach(key => {
      const el = document.querySelector(`[data-edit="${key}"]`);
      if(!el) return;
      const val = content[key];
      if(key === 'hero.title'){
        const woodEl = el.querySelector('.text-wood');
        const rest = (val || '').trim();
        if(woodEl){
          const parts = rest.split('—');
          el.innerHTML = '';
          if(parts.length > 1){
            el.appendChild(document.createTextNode(parts[0].trim() + ' — '));
            const span = document.createElement('span');
            span.className = 'text-wood';
            span.textContent = parts.slice(1).join('—').trim();
            el.appendChild(span);
          } else {
            el.appendChild(document.createTextNode(rest));
          }
        } else {
          el.textContent = rest;
        }
      } else {
        el.textContent = val;
      }
    });
  }).catch(() => {});

  window.API.getMedia().then(media => {
    if(!media || !Object.keys(media).length) return;
    localStorage.setItem('modul_dnr_media', JSON.stringify(media));
    if(media.hero && media.hero.dataUrl){
      const heroImg = document.querySelector('.hero__bg img');
      if(heroImg){
        heroImg.src = media.hero.dataUrl;
        heroImg.removeAttribute('srcset');
        heroImg.removeAttribute('sizes');
      }
    }
    if(media.logo && media.logo.dataUrl){
      document.querySelectorAll('.logo__mark').forEach(m => {
        m.textContent = '';
        const img = document.createElement('img');
        img.src = media.logo.dataUrl;
        img.alt = 'Логотип Модуль ДНР';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
        m.appendChild(img);
      });
    }
    window.__mediaCatalog = media.catalog || {};
    window.__mediaGallery = (media.gallery && media.gallery.length) ? media.gallery : [];
    renderCatalog();
    renderGallery();
  }).catch(() => {});

  window.API.getProducts().then(list => {
    const custom = (list || []).filter(p => p.id && p.id.startsWith('custom_'));
    if(!custom.length) return;
    localStorage.setItem('modul_dnr_custom_products', JSON.stringify(custom));
    window.__customProducts = custom;
    renderCatalog();
    fillModelSelect(true);
  }).catch(() => {});

  window.API.getGallery().then(list => {
    if(!list || !list.length) return;
    const mapped = list.map(g => ({ id: g.id, dataUrl: g.data_url, fileName: g.file_name }));
    localStorage.setItem('modul_dnr_custom_gallery', JSON.stringify(mapped));
    window.__customGallery = mapped;
    renderGallery();
  }).catch(() => {});
}

/* ---------- Инициализация ---------- */
document.getElementById('year').textContent = new Date().getFullYear();
applyContentAndMedia();
renderCatalog();
renderGallery();
fillModelSelect();
window.dispatchEvent(new Event('content-applied'));

// Догрузка из Supabase — после полной отрисовки страницы, чтобы не тормозить первый экран
if (document.readyState === 'complete') {
  scheduleApiLoad();
} else {
  window.addEventListener('load', scheduleApiLoad, { once: true });
}

function scheduleApiLoad(){
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(loadFromApi, { timeout: 2000 });
  } else {
    setTimeout(loadFromApi, 300);
  }
}

/* ---------- Cookie-баннер ---------- */
(function(){
  const COOKIE_KEY = 'modul_dnr_cookie_consent';
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  if(!banner || !acceptBtn) return;
  if(localStorage.getItem(COOKIE_KEY) === 'accepted') return;
  banner.classList.add('is-show');
  acceptBtn.addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    banner.classList.remove('is-show');
  });
})();
