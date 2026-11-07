/** Télécharge un fichier produit dans le navigateur (lien éphémère). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Télécharge un texte (ICS, CSV…) sous le nom `filename`. */
export function downloadTextFile(filename: string, content: string, mime: string) {
  downloadBlob(filename, new Blob([content], { type: mime }));
}
