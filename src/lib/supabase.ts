import { createClient } from "@supabase/supabase-js";
import { env as publicEnv } from "$env/dynamic/public";
import type { Database } from "./database.types";

const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Identifiant « à créer » des fonctions SQL save_sale, save_order, save_tasting (null en base).
 * Le générateur de types ne sait pas qu'un paramètre de fonction accepte null : il le type `string`.
 */
export const NEW_ROW = null as unknown as string;

/** Valeur littérale pour `.ilike()` (comparaison insensible à la casse, sans jokers `%` ni `_`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** Lecture paginée (PostgREST limite à 1000 lignes par défaut). */
export async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}
