import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import type { Database } from "$lib/database.types";

/**
 * Client Supabase du serveur, clé service_role (SUPABASE_SERVICE_ROLE_KEY) : contourne la RLS,
 * donc jamais importé côté navigateur. null si la clé n'est pas configurée.
 */
let client: SupabaseClient<Database> | null | undefined;

export function supabaseAdmin(): SupabaseClient<Database> | null {
  if (client === undefined) {
    const url = publicEnv.PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    client = url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }
  return client;
}
