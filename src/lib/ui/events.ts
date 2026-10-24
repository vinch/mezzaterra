/** Gestionnaire qui annule l'action par défaut (soumission de formulaire…) puis appelle `fn`. */
export function preventDefault<E extends Event>(fn: (e: E) => void) {
  return (e: E) => {
    e.preventDefault();
    fn(e);
  };
}

/** Gestionnaire appelé seulement si l'événement vise l'élément lui-même (clic sur un fond de modale). */
export function self<E extends Event>(fn: (e: E) => void) {
  return (e: E) => {
    if (e.target === e.currentTarget) fn(e);
  };
}
