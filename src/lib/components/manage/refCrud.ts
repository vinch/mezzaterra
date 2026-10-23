import type { Country, Region } from "$lib/types";

/** Description des pages de référentiel (RefCrudPage) : champs, colonnes et listes de choix. */

export type RefOption = { value: string; label: string };

/** Champ du formulaire. Les valeurs vides des champs facultatifs sont enregistrées à `null`. */
export type RefField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "email" | "tel" | "url" | "number" | "select";
  required?: boolean;
  /** Options d'un `select` (souvent issues d'un autre référentiel, donc réactives). */
  options?: RefOption[];
  /** Occupe toute la largeur (sinon deux champs par ligne). */
  full?: boolean;
  placeholder?: string;
  help?: string;
};

/** Colonne du tableau (la première est en gras, ou lien vers la fiche). */
export type RefColumn = {
  label: string;
  value: (row: any) => string | null | undefined;
  /** Lien externe ouvert dans un nouvel onglet. */
  href?: (row: any) => string | null | undefined;
  /** Coupe le texte au-delà de N caractères (texte complet en infobulle). */
  truncate?: number;
};

/** « 🇮🇹 Italie » (vide sans pays). */
export function countryLabel(c: { flag?: string | null; name?: string | null } | null | undefined): string {
  return [c?.flag, c?.name].filter(Boolean).join(" ");
}

export function countryOptions(countries: Country[]): RefOption[] {
  return countries.map((c) => ({ value: c.id, label: countryLabel(c) }));
}

/** « Abruzzo · Italie ». */
export function regionOptions(regions: Region[]): RefOption[] {
  return regions.map((r) => ({ value: r.id, label: [r.name, r.country?.name].filter(Boolean).join(" · ") }));
}

/** Coordonnées : email, téléphone, adresse et pays (clients, fournisseurs, transporteurs). */
export function addressFields(countries: RefOption[]): RefField[] {
  return [
    { key: "email", label: "Email", type: "email" },
    { key: "phone_number", label: "Téléphone", type: "tel" },
    { key: "address_line_1", label: "Adresse ligne 1", full: true },
    { key: "address_line_2", label: "Adresse ligne 2", full: true },
    { key: "zip_code", label: "Code postal" },
    { key: "city", label: "Ville" },
    { key: "country_id", label: "Pays", type: "select", options: countries },
  ];
}

/** Contact professionnel (fournisseurs, transporteurs). */
export function contactFields(countries: RefOption[]): RefField[] {
  return [
    { key: "name", label: "Nom", required: true, full: true },
    ...addressFields(countries),
    { key: "vat", label: "Numéro de TVA" },
  ];
}

export const CONTACT_COLUMNS: RefColumn[] = [
  { label: "Nom", value: (s) => s.name },
  { label: "Email", value: (s) => s.email },
  { label: "Téléphone", value: (s) => s.phone_number },
  { label: "Ville", value: (s) => s.city },
  { label: "Pays", value: (s) => countryLabel(s.country) },
  { label: "TVA", value: (s) => s.vat },
];
