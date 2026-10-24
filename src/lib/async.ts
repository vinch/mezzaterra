/** Message lisible d'une erreur quelconque (exception, rejet de promesse…). */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Garde « la dernière demande gagne » : si l'on ouvre une autre fiche pendant un
 * chargement, la réponse la plus ancienne est ignorée au lieu d'écraser la nouvelle.
 */
export function latestOnly() {
  let current = 0;
  return {
    /**
     * Résultat de `load`, ou `undefined` s'il a échoué (`onError` est alors appelé) ou si
     * une demande plus récente a été lancée entre-temps (résultat et erreur ignorés).
     */
    async run<T>(load: () => Promise<T>, onError: (e: unknown) => void): Promise<T | undefined> {
      const request = ++current;
      try {
        const result = await load();
        return request === current ? result : undefined;
      } catch (e) {
        if (request === current) onError(e);
        return undefined;
      }
    },
    /** Rend obsolètes les demandes en cours. */
    cancel() {
      current++;
    },
  };
}
