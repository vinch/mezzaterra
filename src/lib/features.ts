import { supabase } from "./supabase";

/**
 * Détection des objets SQL ajoutés par les migrations récentes.
 * Le code doit continuer à fonctionner si une migration n'est pas encore appliquée :
 * on sonde une fois, on met en cache, et l'UI masque ce qui n'est pas disponible.
 */

type MaybeError = { code?: string; message?: string } | null | undefined;
type ProbeResult = { error: MaybeError; status?: number };

const MISSING_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "PGRST200", // relation absente du cache de schéma
  "PGRST202", // fonction absente du cache de schéma
  "PGRST204", // colonne absente du cache de schéma
  "PGRST205", // table absente du cache de schéma
]);

export function isMissingSchemaError(error: MaybeError): boolean {
  if (!error) return false;
  if (error.code && MISSING_CODES.has(error.code)) return true;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  );
}

const cache = new Map<string, Promise<boolean>>();

function probe(key: string, run: () => PromiseLike<ProbeResult>): Promise<boolean> {
  let p = cache.get(key);
  if (!p) {
    p = Promise.resolve(run())
      /* PostgREST répond 404 pour une table / fonction inconnue (parfois sans corps d'erreur). */
      .then(({ error, status }) => !(status === 404 || isMissingSchemaError(error)))
      .catch(() => false);
    cache.set(key, p);
  }
  return p;
}

/** Colonne présente ? (une erreur RLS ou réseau compte comme « présente ».) */
export function hasColumn(table: string, column: string): Promise<boolean> {
  return probe(`col:${table}.${column}`, () =>
    (supabase.from(table as any) as any).select(column).limit(0),
  );
}

/** Table présente ? */
export function hasTable(table: string): Promise<boolean> {
  return probe(`table:${table}`, () =>
    (supabase.from(table as any) as any).select("*").limit(0),
  );
}

/** Les colonnes publiques ajoutées sur `tasting` (date, heure, prix, capacité…). */
export function hasTastingExtras(): Promise<boolean> {
  return hasColumn("tasting", "capacity");
}
