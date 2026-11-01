/** Message lisible d'une erreur quelconque (exception, rejet de promesse…). */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Action sur une ligne de liste (créer la vente, ignorer…) : `busy(id)` pendant l'action pour
 * désactiver ses boutons, erreur précédente effacée puis remplacée par celle de l'action ;
 * `after` (relevé, compteurs) seulement si l'action réussit.
 */
export function rowAction(opts: { busy: (id: string) => void; error: (message: string) => void; after?: () => unknown }) {
  return async (id: string, action: () => Promise<unknown>) => {
    opts.error("");
    opts.busy(id);
    try {
      await action();
      await opts.after?.();
    } catch (e) {
      opts.error(errorMessage(e));
    } finally {
      opts.busy("");
    }
  };
}

/**
 * Garde « la dernière demande gagne » : si l'on ouvre une autre fiche pendant un
 * chargement, la réponse la plus ancienne est ignorée au lieu d'écraser la nouvelle.
 * `onError` reçoit l'erreur de la dernière demande seulement.
 */
export function latestOnly(onError: (e: unknown) => void) {
  let current = 0;
  return {
    /** Résultat de `load`, ou `undefined` s'il a échoué ou a été dépassé par une demande plus récente. */
    async run<T>(load: () => Promise<T>): Promise<T | undefined> {
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
