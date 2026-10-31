/**
 * Copie de `list` où l'élément `i` échange sa place avec son voisin à `delta` (-1 : monter,
 * 1 : descendre) ; `list` elle-même si le voisin n'existe pas.
 */
export function moveItem<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
