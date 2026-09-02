-- ============================================================
-- Модуль ДНР — миграция Supabase
-- Выполнить в Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Контент сайта (тексты блоков)
create table if not exists public.content (
  key text primary key,
  value text not null default ''
);

-- Медиа (изображения как base64 data-url)
create table if not exists public.media (
  key text primary key,
  data_url text not null default '',
  file_name text not null default ''
);

-- Товары каталога (добавленные через админку)
create table if not exists public.products (
  id text primary key,
  title text not null,
  dims text default '',
  area numeric default 0,
  price numeric default 0,
  tag text default '',
  img text default ''
);

-- Галерея «Наши работы» (дополнительные фото)
create table if not exists public.gallery (
  id bigserial primary key,
  data_url text not null default '',
  file_name text not null default '',
  created_at timestamptz default now()
);

-- Заявки с формы
create table if not exists public.requests (
  id bigserial primary key,
  name text default '',
  phone text default '',
  model text default '',
  comment text default '',
  status text default 'new',
  created_at timestamptz default now()
);

-- Контакты
create table if not exists public.contacts (
  id bigserial primary key,
  name text default '',
  phone text default '',
  telegram text default '',
  vk text default '',
  source text default '',
  created_at timestamptz default now()
);

-- Индексы
create index if not exists idx_requests_created on public.requests(created_at desc);
create index if not exists idx_contacts_created on public.contacts(created_at desc);
create index if not exists idx_gallery_created on public.gallery(created_at desc);

-- ============================================================
-- RLS: включаем защиту. Доступ идёт только через service_role
-- (серверные функции Vercel), поэтому политик для anon не создаём.
-- ============================================================
alter table public.content  enable row level security;
alter table public.media    enable row level security;
alter table public.products enable row level security;
alter table public.gallery  enable row level security;
alter table public.requests enable row level security;
alter table public.contacts enable row level security;
