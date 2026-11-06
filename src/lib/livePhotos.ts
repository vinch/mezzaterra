import { downloadBlob } from "./download";
import { fold } from "./format";
import { loadImage } from "./images";

/**
 * Photos prises par l'invité pendant le mode live : une par produit, gardées sur son téléphone
 * (IndexedDB, le localStorage est trop petit pour des images) et jamais envoyées.
 * Clé `${tastingId}:${lotId}`. Sans IndexedDB (navigation privée…), la photo ne vit que le temps de la visite.
 */

const DB_NAME = "mz-live";
const STORE = "photos";
/** Plus grand côté gardé : assez pour un souvenir net, sans remplir le téléphone. */
const MAX_SIDE = 1600;

type PhotoRecord = { lotId: string; blob: Blob };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      /* Connexion coupée par le navigateur (téléphone en veille sur iOS…) : rouverte au prochain accès. */
      req.result.onclose = () => (dbPromise = null);
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/** Une requête dans sa transaction ; résolue une fois la transaction terminée (écriture durable). */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  let tx: IDBTransaction;
  try {
    tx = (await openDb()).transaction(STORE, mode);
  } catch {
    /* Connexion perdue sans « close » (WebKit) : une seule nouvelle tentative, sur une connexion neuve. */
    dbPromise = null;
    tx = (await openDb()).transaction(STORE, mode);
  }
  const req = fn(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
  });
}

const key = (tastingId: string, lotId: string) => `${tastingId}:${lotId}`;

/** Photos de la dégustation, par lot. */
export async function loadPhotos(tastingId: string): Promise<Record<string, Blob>> {
  try {
    const prefix = `${tastingId}:`;
    const rows = await run<PhotoRecord[]>("readonly", (s) => s.getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)));
    return Object.fromEntries(rows.map((r) => [r.lotId, r.blob]));
  } catch {
    return {};
  }
}

let persistAsked = false;

export async function savePhoto(tastingId: string, lotId: string, blob: Blob): Promise<void> {
  try {
    await run("readwrite", (s) => s.put({ lotId, blob } satisfies PhotoRecord, key(tastingId, lotId)));
    /* Demande (une fois) au navigateur de ne pas effacer ces données quand le téléphone manque de place. */
    if (!persistAsked) {
      persistAsked = true;
      void navigator.storage?.persist?.().catch(() => {});
    }
  } catch {
    /* Pas d'IndexedDB : la photo reste affichée jusqu'à la fin de la visite. */
  }
}

export async function deletePhoto(tastingId: string, lotId: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(key(tastingId, lotId)));
  } catch {
    /* Rien à effacer. */
  }
}

/** Photo de l'appareil réduite (JPEG, MAX_SIDE px au plus) ; illisible par le navigateur : gardée telle quelle. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");
  try {
    /* L'élément <img> applique déjà l'orientation EXIF : la photo n'arrive pas couchée. */
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    /* Pas de canevas (mémoire de Safari épuisée…) : l'original plutôt qu'une image noire. */
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
    /* Libère la mémoire du canevas tout de suite (Safari plafonne le total). */
    canvas.width = canvas.height = 0;
  }
}

/**
 * Enregistre la photo hors du navigateur : feuille de partage du téléphone (« Enregistrer l'image »),
 * sinon téléchargement.
 */
export async function exportPhoto(blob: Blob, name: string): Promise<void> {
  const slug = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo";
  const file = new File([blob], `mezzaterra-${slug}.jpg`, { type: blob.type || "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      /* Partage refusé (contexte non sécurisé…) : on télécharge. */
    }
  }
  downloadBlob(file.name, file);
}
