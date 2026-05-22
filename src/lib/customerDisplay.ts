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

/** Tri alphabétique français sur le libellé affiché. */
export function sortCustomersByLabel<
  T extends {
    first_name: string;
    last_name: string;
    company_name?: string | null;
  },
>(customers: T[]): T[] {
  return [...customers].sort((a, b) =>
    customerDisplayLabel(a).localeCompare(customerDisplayLabel(b), "fr", {
      sensitivity: "base",
    }),
  );
}
