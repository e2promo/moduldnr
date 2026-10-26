# Деплой на https://moduldnr.vercel.app/ (зеркало, закрыто от индексации)

Основной сайт — https://moduldnr.ru/. Vercel-версия не индексируется: `noindex` в meta и заголовок `X-Robots-Tag` (vercel.json), canonical указывает на .ru.
Если позже сделаете Vercel основным сайтом — уберите noindex из `index.html`, `privacy.html` и `vercel.json`, верните canonical/sitemap на vercel.app.

1. **Supabase**: создайте проект и выполните `supabase/schema.sql` в SQL Editor.
2. **Vercel → Settings → Environment Variables** (затем Redeploy):

| Переменная | Значение |
|---|---|
| `SUPABASE_URL` | https://xxxx.supabase.co |
| `SUPABASE_KEY` | ключ **service_role** (только на сервере) |
| `ADMIN_TOKEN` | пароль админки (длинный, случайный) |
| `ADMIN_LOGIN` | логин админки (по умолчанию `admin`) |
| `TG_BOT_TOKEN` | токен бота (НОВЫЙ, см. ниже) |
| `TG_CHAT_ID` | chat_id получателя заявок |

3. Вход в админку: `/admin.html`. Логин — `ADMIN_LOGIN` (по умолчанию `admin`), пароль — `ADMIN_TOKEN`. Чтобы войти по прежнему паролю, задайте `ADMIN_TOKEN=admin123` (см. предупреждение ниже).

> Пароль `admin123` был виден всем в открытом репозитории. Для безопасности лучше задать новый длинный пароль.

> Токен бота раньше был прописан в `index.html` в открытом репозитории — считайте его скомпрометированным:
> перевыпустите в @BotFather (`/revoke`) и вставьте новый только в `TG_BOT_TOKEN`.

Ограничение Vercel: тело запроса до 4,5 МБ — крупные фото перед загрузкой в админку лучше сжимать.
