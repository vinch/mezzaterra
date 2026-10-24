import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Stock disponible mis en forme pour les documents (tarifs, feuilles de notes) et la page Stock.
 * Sans jsPDF : les générateurs PDF vivent dans pdf/stockDocumentsPdf.ts, chargé à la demande.
 */

export type StockDocVintage = {
  id: string;
  wine_id: string;
  wine_type_id: string | null;
  winery_id: string;
  quantity_on_hand: number;
  production_year: number;
  year: number | null;
  price: number | null;
  abv: number | null;
  wineName: string;
  wineryName: string;
  wineTypeName: string;
  wineTypeCategory: string | null;
  appellationLine: string;
  grapeNames: string[];
};

function wineDisplayName(wine: {
  name: string | null;
  appelation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  if (wine.name?.trim()) return wine.name.trim();
  const ap = wine.appelation;
  const parts = [ap?.label?.name, ap?.name].filter(Boolean) as string[];
  return parts.join(" ").trim() || "Sans nom";
}

function appellationLine(wine: {
  appelation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  const ap = wine.appelation;
  if (!ap) return "";
  const parts = [ap.label?.name, ap.name].filter(Boolean) as string[];
  return parts.join(" ");
}

function collectGrapeNames(
  rows: { grape?: { name: string } | null; percentage: number | null }[] | null | undefined,
): string[] {
  if (!rows?.length) return [];
  const sorted = [...rows].sort((a, b) => {
    const pa = a.percentage ?? 0;
    const pb = b.percentage ?? 0;
    if (pa !== pb) return pb - pa;
    return (a.grape?.name || "").localeCompare(b.grape?.name || "");
  });
  return sorted
    .map((r) => r.grape?.name)
    .filter((n): n is string => Boolean(n?.trim()));
}

export function mapInventoryToDocVintages(
  invRows: {
    quantity_on_hand: number | null;
    wine_vintage: {
      id: string;
      production_year: number;
      year: number | null;
      price: number | null;
      abv: number | null;
      wine: {
        id: string;
        winery_id: string;
        name: string | null;
        wine_type_id: string | null;
        winery?: { name: string | null } | null;
        appelation?: {
          name: string | null;
          label?: { name: string | null } | null;
        } | null;
        wine_type?: { name: string; category?: string | null } | null;
      } | null;
      wine_vintage_grape?: {
        percentage: number | null;
        grape: { name: string } | null;
      }[] | null;
    } | null;
  }[],
): StockDocVintage[] {
  const out: StockDocVintage[] = [];
  for (const row of invRows) {
    const v = row.wine_vintage;
    const w = v?.wine;
    if (!v || !w || (row.quantity_on_hand ?? 0) <= 0) continue;
    out.push({
      id: v.id,
      wine_id: w.id,
      wine_type_id: w.wine_type_id ?? null,
      winery_id: w.winery_id,
      quantity_on_hand: row.quantity_on_hand ?? 0,
      production_year: v.production_year,
      year: v.year,
      price: v.price,
      abv: v.abv,
      wineName: wineDisplayName(w),
      wineryName: w.winery?.name?.trim() || "—",
      wineTypeName: w.wine_type?.name?.trim() || "Autre",
      wineTypeCategory: w.wine_type?.category ?? null,
      appellationLine: appellationLine(w),
      grapeNames: collectGrapeNames(v.wine_vintage_grape),
    });
  }
  return out;
}

export async function fetchStockDocVintages(
  supabase: SupabaseClient<Database>,
): Promise<{ data: StockDocVintage[]; error: string | null }> {
  const { data: invRows, error: invErr } = await supabase
    .from("inventory")
    .select("wine_vintage_id, quantity_on_hand")
    .gt("quantity_on_hand", 0);

  if (invErr) {
    return { data: [], error: invErr.message };
  }

  /** Plusieurs lignes inventaire pour le même millésime → une seule ligne doc (quantités additionnées). */
  const qtyByVintage = new Map<string, number>();
  for (const r of invRows || []) {
    const vid = r.wine_vintage_id;
    if (vid == null) continue;
    const q = r.quantity_on_hand ?? 0;
    if (q <= 0) continue;
    qtyByVintage.set(vid, (qtyByVintage.get(vid) ?? 0) + q);
  }

  if (qtyByVintage.size === 0) {
    return { data: [], error: null };
  }

  const ids = [...qtyByVintage.keys()];

  const { data: vintages, error: vErr } = await supabase
    .from("wine_vintage")
    .select(
      `
      id,
      production_year,
      year,
      price,
      abv,
      wine (
        id,
        winery_id,
        name,
        wine_type_id,
        winery (name),
        appelation (name, label (name)),
        wine_type (name, category)
      ),
      wine_vintage_grape (
        percentage,
        grape (name)
      )
    `,
    )
    .in("id", ids);

  if (vErr) {
    return { data: [], error: vErr.message };
  }

  const vintageMap = new Map((vintages || []).map((v) => [v.id, v]));

  const merged: Parameters<typeof mapInventoryToDocVintages>[0] = [];
  for (const [wine_vintage_id, quantity_on_hand] of qtyByVintage) {
    const v = vintageMap.get(wine_vintage_id);
    if (!v?.wine) continue;
    merged.push({
      quantity_on_hand,
      wine_vintage: v,
    } as Parameters<typeof mapInventoryToDocVintages>[0][number]);
  }

  return { data: mapInventoryToDocVintages(merged), error: null };
}

/** Même ordre que les listes Vins / Stock : vignoble, nom (ou appellation), millésime ↓. */
function sortDocVintages(a: StockDocVintage, b: StockDocVintage): number {
  const wineryA = a.wineryName.toLowerCase();
  const wineryB = b.wineryName.toLowerCase();
  if (wineryA !== wineryB) return wineryA.localeCompare(wineryB);
  const nameA = a.wineName.toLowerCase();
  const nameB = b.wineName.toLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return b.production_year - a.production_year;
}

export function sortedStockForDocuments(rows: StockDocVintage[]): StockDocVintage[] {
  return [...rows].sort(sortDocVintages);
}

export function stockVintageLabel(v: StockDocVintage): string {
  if (v.year != null && v.year !== v.production_year) {
    return `${v.year} (${v.production_year})`;
  }
  return String(v.production_year);
}
