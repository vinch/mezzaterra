/** Action Svelte : rend l'élément dans <body> (jamais rogné par une modale ou un overflow). */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}
