import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service role: salta RLS. Usar SOLO en código de servidor que ya validó permisos. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
