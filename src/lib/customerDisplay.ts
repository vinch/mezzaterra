import { fold } from "$lib/format";

/** Libellé affiché pour un client (nom + société éventuelle). */
export function customerDisplayLabel(c: {
  first_name: string;
  last_name: string;
  company_name?: string | null;
}): string {
  const name = `${c.first_name} ${c.last_name}`.trim();
  if (c.company_name?.trim()) {
    return `${name} (${c.company_name.trim()})`;
  }
  return name;
}

type Labelled = {
  first_name: string;
  last_name: string;
  company_name?: string | null;
};

/** Ordre alphabétique français sur le libellé affiché. */
export function compareCustomersByLabel(a: Labelled, b: Labelled): number {
  return customerDisplayLabel(a).localeCompare(customerDisplayLabel(b), "fr", { sensitivity: "base" });
}

/** Tri alphabétique français sur le libellé affiché. */
export function sortCustomersByLabel<T extends Labelled>(customers: T[]): T[] {
  return [...customers].sort(compareCustomersByLabel);
}

type Named = { id: string; first_name: string; last_name: string };

/** Nom comparable : sans accents, casse ni espaces en trop (« Benoît  Decoene » = « benoit decoene »). */
function nameKey(c: Named): string {
  return fold(`${c.first_name} ${c.last_name}`).replace(/\s+/g, " ").trim();
}

/**
 * Autres fiches au même nom : doublons probables, typiquement un client déjà connu qui a réservé
 * sur le site avec un autre email (fusion depuis sa fiche, fonction SQL merge_customers).
 * Plus large que registration_customer_match (accents ignorés) : ce n'est qu'un signalement,
 * l'admin décide.
 */
export function namesakes<T extends Named>(c: Named, customers: T[]): T[] {
  const key = nameKey(c);
  return customers.filter((o) => o.id !== c.id && nameKey(o) === key);
}

/** Ids des clients qui partagent leur nom avec une autre fiche (même règle que namesakes). */
export function namesakeIds(customers: Named[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const c of customers) {
    const key = nameKey(c);
    byKey.set(key, [...(byKey.get(key) ?? []), c.id]);
  }
  return new Set([...byKey.values()].filter((ids) => ids.length > 1).flat());
}
