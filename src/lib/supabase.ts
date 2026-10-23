import { createClient } from "@supabase/supabase-js";
import { env as publicEnv } from "$env/dynamic/public";
import type { Database } from "./database.types";

const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/** Valeur littérale pour `.ilike()` (comparaison insensible à la casse, sans jokers `%` ni `_`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
