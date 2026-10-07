import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "@/lib/env";

/**
 * Client com service role — só para uso no servidor (Storage, admin de auth).
 * Nunca importar em código que chegue ao browser.
 */
export function createAdminClient() {
  return createClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL")!,
    readEnv("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
