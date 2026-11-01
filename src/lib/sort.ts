/** Tri des tableaux de la gestion (en-têtes `SortHeader`). */

export type SortDir = "asc" | "desc";
export type SortState<K extends string = string> = { key: K; dir: SortDir };

/** Compare deux valeurs dans le sens du tri ; une valeur absente (null) reste en fin de liste dans les deux sens. */
export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
  if (a == null || b == null) return Number(a == null) - Number(b == null);
  const c = typeof a === "string" || typeof b === "string" ? String(a).localeCompare(String(b), "fr") : a - b;
  return dir === "asc" ? c : -c;
}
