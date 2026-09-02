/* =====================================================================
   Модуль ДНР — обёртка для работы с API (Vercel Serverless + Supabase)
   Используется в admin.html и index.html
   ===================================================================== */

const API = (() => {
  const BASE = '/api/cms';
  const TIMEOUT = 8000;
  let _token = '';

  function setToken(t) { _token = t; }

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (_token) h['Authorization'] = 'Bearer ' + _token;
    return h;
  }

  async function get(type) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${BASE}?type=${type}`, { headers: headers(), signal: ctrl.signal });
      if (!res.ok) throw new Error('API GET error: ' + res.status);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function post(action, type, data) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT * 2);
    try {
      const res = await fetch(BASE, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ action, type, data }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('API POST error: ' + res.status);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    setToken, get, post,

    getContent: () => get('content'),
    saveContent: (data) => post('saveContent', 'content', data),

    getMedia: async () => {
      const flat = await get('media');
      const out = {};
      Object.entries(flat || {}).forEach(([key, val]) => {
        if (key === 'hero' || key === 'logo') out[key] = val;
        else if (key.startsWith('catalog_')) {
          if (!out.catalog) out.catalog = {};
          out.catalog[key.replace('catalog_', '')] = val;
        } else if (key.startsWith('gallery_')) {
          if (!out.gallery) out.gallery = [];
          const idx = parseInt(key.replace('gallery_', ''), 10);
          out.gallery[idx] = val;
        }
      });
      return out;
    },
    saveMedia: (key, dataUrl, fileName) => post('saveMedia', 'media', { key, dataUrl, fileName }),
    deleteMedia: (key) => post('deleteMedia', 'media', { key }),

    getProducts: () => get('products'),
    addProduct: (product) => post('addProduct', 'products', { product }),
    deleteProduct: (id) => post('deleteProduct', 'products', { id }),

    getGallery: () => get('gallery'),
    addGalleryItem: (dataUrl, fileName) => post('addGalleryItem', 'gallery', { dataUrl, fileName }),
    deleteGalleryItem: (id) => post('deleteGalleryItem', 'gallery', { id }),

    getRequests: () => get('requests'),
    addRequest: (r) => post('addRequest', 'requests', r),
    updateRequest: (id, status) => post('updateRequest', 'requests', { id, status }),
    deleteRequest: (id) => post('deleteRequest', 'requests', { id }),

    getContacts: () => get('contacts'),
    addContact: (c) => post('addContact', 'contacts', c),
    deleteContact: (id) => post('deleteContact', 'contacts', { id })
  };
})();
window.API = API;