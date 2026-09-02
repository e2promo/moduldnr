// Supabase клиент для серверных функций Vercel (service_role — только на сервере)
import { createClient } from '@supabase/supabase-js';

// Поддерживаем оба набора имён переменных (Vercel-интеграция Supabase и ручные)
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Не заданы переменные окружения: нужен NEXT_PUBLIC_SUPABASE_URL (или SUPABASE_URL) и SUPABASE_SERVICE_ROLE_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
