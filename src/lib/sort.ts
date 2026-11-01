/** Tri des tableaux de la gestion (en-têtes `SortHeader`). */

export type SortDir = "asc" | "desc";
export type SortState<K extends string = string> = { key: K; dir: SortDir };
export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator("fr");

/** Compare deux valeurs dans le sens du tri ; une valeur absente (null ou texte vide) reste en fin de liste dans les deux sens. */
export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const missA = a == null || a === "";
  const missB = b == null || b === "";
  if (missA || missB) return Number(missA) - Number(missB);
  const c = typeof a === "string" || typeof b === "string" ? collator.compare(String(a), String(b)) : (a as number) - (b as number);
  return dir === "asc" ? c : -c;
}

/**
 * Copie de `rows` triée selon `sort` ; `values` donne, pour chaque colonne triable, la valeur triée d'une
 * ligne (calculée une fois par ligne). Le tri est stable : à égalité, les lignes gardent leur ordre d'origine.
 */
export function sortedBy<T, K extends string>(rows: readonly T[], sort: SortState<K>, values: Record<K, (row: T) => SortValue>): T[] {
  const value = values[sort.key];
  return rows
    .map((row) => ({ row, v: value(row) }))
    .sort((a, b) => compareValues(a.v, b.v, sort.dir))
    .map((e) => e.row);
}
