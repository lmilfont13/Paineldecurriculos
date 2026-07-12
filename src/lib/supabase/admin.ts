import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Client com service role — só para uso no servidor (Storage, admin de auth).
 * Nunca importar em código que chegue ao browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
