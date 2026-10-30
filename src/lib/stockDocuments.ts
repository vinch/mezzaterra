import { errorMessage } from "./async";
import { fetchStockMap } from "./manageData";
import { supabase } from "./supabase";
import { kindOf, type ProductKind } from "./productKinds";
import { byVolume, withVolume } from "./wine";

/**
 * Stock disponible mis en forme pour les documents (tarifs, feuilles de notes) et la page Stock.
 * Sans jsPDF : les générateurs PDF vivent dans pdf/stockDocumentsPdf.ts, chargé à la demande.
 */

export type StockDocVintage = {
  id: string;
  wine_id: string;
  kind: ProductKind;
  wine_type_id: string | null;
  winery_id: string;
  quantity_on_hand: number;
  production_year: number;
  year: number | null;
  volume_ml: number;
  price: number | null;
  abv: number | null;
  wineName: string;
  wineryName: string;
  wineTypeName: string;
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
      volume_ml: number;
      price: number | null;
      abv: number | null;
      wine: {
        id: string;
        kind?: string | null;
        winery_id: string;
        name: string | null;
        wine_type_id: string | null;
        winery?: { name: string | null } | null;
        appelation?: {
          name: string | null;
          label?: { name: string | null } | null;
        } | null;
        wine_type?: { name: string } | null;
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
      kind: kindOf({ kind: w.kind }),
      wine_type_id: w.wine_type_id ?? null,
      winery_id: w.winery_id,
      quantity_on_hand: row.quantity_on_hand ?? 0,
      production_year: v.production_year,
      year: v.year,
      volume_ml: v.volume_ml,
      price: v.price,
      abv: v.abv,
      wineName: wineDisplayName(w),
      wineryName: w.winery?.name?.trim() || "—",
      wineTypeName: w.wine_type?.name?.trim() || "Autre",
      appellationLine: appellationLine(w),
      grapeNames: collectGrapeNames(v.wine_vintage_grape),
    });
  }
  return out;
}

export async function fetchStockDocVintages(): Promise<{ data: StockDocVintage[]; error: string | null }> {
  let stock: Map<string, number>;
  try {
    stock = await fetchStockMap();
  } catch (e) {
    return { data: [], error: errorMessage(e) };
  }
  const qtyByVintage = new Map([...stock].filter(([, q]) => q > 0));

  if (qtyByVintage.size === 0) {
    return { data: [], error: null };
  }

  /* Millésimes lus par lots de 100 identifiants : une seule liste ferait une URL trop longue. */
  const ids = [...qtyByVintage.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const pages = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("wine_vintage")
        .select(
          `
          id,
          production_year,
          year,
          volume_ml,
          price,
          abv,
          wine (
            id,
            kind,
            winery_id,
            name,
            wine_type_id,
            winery (name),
            appelation (name, label (name)),
            wine_type (name)
          ),
          wine_vintage_grape (
            percentage,
            grape (name)
          )
        `,
        )
        .in("id", chunk),
    ),
  );
  const failed = pages.find((p) => p.error);
  if (failed?.error) {
    return { data: [], error: failed.error.message };
  }
  const vintages = pages.flatMap((p) => p.data || []);

  const vintageMap = new Map(vintages.map((v) => [v.id, v]));

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

/** Même ordre que les listes Produits / Stock : domaine, nom (ou appellation), millésime ↓. */
function sortDocVintages(a: StockDocVintage, b: StockDocVintage): number {
  const wineryA = a.wineryName.toLowerCase();
  const wineryB = b.wineryName.toLowerCase();
  if (wineryA !== wineryB) return wineryA.localeCompare(wineryB);
  const nameA = a.wineName.toLowerCase();
  const nameB = b.wineName.toLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return b.production_year - a.production_year || byVolume(a, b);
}

export function sortedStockForDocuments(rows: StockDocVintage[]): StockDocVintage[] {
  return [...rows].sort(sortDocVintages);
}

/** « 2019 (2021) », « 2025 · 5 L » : année (et mise en bouteille), contenant hors bouteille standard. */
export function stockVintageLabel(v: StockDocVintage): string {
  const year = v.year != null && v.year !== v.production_year ? `${v.year} (${v.production_year})` : String(v.production_year);
  return withVolume(year, v, v.kind);
}
