-- Выполнить один раз в Supabase → SQL Editor
create table if not exists content  (key text primary key, value text);
create table if not exists media    (key text primary key, data_url text, file_name text);
create table if not exists products (id text primary key, title text, dims text, area numeric default 0, price numeric default 0, tag text, img text);
create table if not exists gallery  (id bigint generated always as identity primary key, data_url text, file_name text, created_at timestamptz default now());
create table if not exists requests (id bigint generated always as identity primary key, name text, phone text, model text, comment text, status text default 'new', created_at timestamptz default now());
create table if not exists contacts (id bigint generated always as identity primary key, name text, phone text, telegram text, vk text, source text, created_at timestamptz default now());

-- Доступ только через сервер (service_role): включаем RLS без политик — анонимный ключ ничего не прочитает
alter table content  enable row level security;
alter table media    enable row level security;
alter table products enable row level security;
alter table gallery  enable row level security;
alter table requests enable row level security;
alter table contacts enable row level security;
