import { errorMessage } from "./async";
import { fetchStockMap } from "./manageData";
import { supabase } from "./supabase";
import { kindOf, type ProductKind } from "./productKinds";
import { byVolume, withVolume } from "./products";

/**
 * Stock disponible mis en forme pour les documents (tarifs, feuilles de notes) et la page Stock.
 * Sans jsPDF : les générateurs PDF vivent dans pdf/stockDocumentsPdf.ts, chargé à la demande.
 */

export type StockDocLot = {
  id: string;
  product_id: string;
  kind: ProductKind;
  product_type_id: string | null;
  producer_id: string;
  quantity_on_hand: number;
  production_year: number;
  year: number | null;
  volume_ml: number;
  price: number | null;
  abv: number | null;
  productName: string;
  producerName: string;
  productTypeName: string;
  appellationLine: string;
  varietyNames: string[];
};

function productDisplayName(product: {
  name: string | null;
  appellation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  if (product.name?.trim()) return product.name.trim();
  const ap = product.appellation;
  const parts = [ap?.label?.name, ap?.name].filter(Boolean) as string[];
  return parts.join(" ").trim() || "Sans nom";
}

function appellationLine(product: {
  appellation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  const ap = product.appellation;
  if (!ap) return "";
  const parts = [ap.label?.name, ap.name].filter(Boolean) as string[];
  return parts.join(" ");
}

function collectVarietyNames(
  rows: { variety?: { name: string } | null; percentage: number | null }[] | null | undefined,
): string[] {
  if (!rows?.length) return [];
  const sorted = [...rows].sort((a, b) => {
    const pa = a.percentage ?? 0;
    const pb = b.percentage ?? 0;
    if (pa !== pb) return pb - pa;
    return (a.variety?.name || "").localeCompare(b.variety?.name || "");
  });
  return sorted
    .map((r) => r.variety?.name)
    .filter((n): n is string => Boolean(n?.trim()));
}

export function mapInventoryToDocLots(
  invRows: {
    quantity_on_hand: number | null;
    lot: {
      id: string;
      production_year: number;
      year: number | null;
      volume_ml: number;
      price: number | null;
      abv: number | null;
      product: {
        id: string;
        kind?: string | null;
        producer_id: string;
        name: string | null;
        product_type_id: string | null;
        producer?: { name: string | null } | null;
        appellation?: {
          name: string | null;
          label?: { name: string | null } | null;
        } | null;
        product_type?: { name: string } | null;
      } | null;
      lot_variety?: {
        percentage: number | null;
        variety: { name: string } | null;
      }[] | null;
    } | null;
  }[],
): StockDocLot[] {
  const out: StockDocLot[] = [];
  for (const row of invRows) {
    const v = row.lot;
    const w = v?.product;
    if (!v || !w || (row.quantity_on_hand ?? 0) <= 0) continue;
    out.push({
      id: v.id,
      product_id: w.id,
      kind: kindOf({ kind: w.kind }),
      product_type_id: w.product_type_id ?? null,
      producer_id: w.producer_id,
      quantity_on_hand: row.quantity_on_hand ?? 0,
      production_year: v.production_year,
      year: v.year,
      volume_ml: v.volume_ml,
      price: v.price,
      abv: v.abv,
      productName: productDisplayName(w),
      producerName: w.producer?.name?.trim() || "—",
      productTypeName: w.product_type?.name?.trim() || "Autre",
      appellationLine: appellationLine(w),
      varietyNames: collectVarietyNames(v.lot_variety),
    });
  }
  return out;
}

export async function fetchStockDocLots(): Promise<{ data: StockDocLot[]; error: string | null }> {
  let stock: Map<string, number>;
  try {
    stock = await fetchStockMap();
  } catch (e) {
    return { data: [], error: errorMessage(e) };
  }
  const qtyByLot = new Map([...stock].filter(([, q]) => q > 0));

  if (qtyByLot.size === 0) {
    return { data: [], error: null };
  }

  /* Lots lus par paquets de 100 identifiants : une seule liste ferait une URL trop longue. */
  const ids = [...qtyByLot.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const pages = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("lot")
        .select(
          `
          id,
          production_year,
          year,
          volume_ml,
          price,
          abv,
          product (
            id,
            kind,
            producer_id,
            name,
            product_type_id,
            producer (name),
            appellation (name, label (name)),
            product_type (name)
          ),
          lot_variety (
            percentage,
            variety (name)
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
  const lots = pages.flatMap((p) => p.data || []);

  const lotMap = new Map(lots.map((v) => [v.id, v]));

  const merged: Parameters<typeof mapInventoryToDocLots>[0] = [];
  for (const [lot_id, quantity_on_hand] of qtyByLot) {
    const v = lotMap.get(lot_id);
    if (!v?.product) continue;
    merged.push({
      quantity_on_hand,
      lot: v,
    } as Parameters<typeof mapInventoryToDocLots>[0][number]);
  }

  return { data: mapInventoryToDocLots(merged), error: null };
}

/** Même ordre que les listes Produits / Stock : producteur, nom (ou appellation), année ↓. */
function sortDocLots(a: StockDocLot, b: StockDocLot): number {
  const producerA = a.producerName.toLowerCase();
  const producerB = b.producerName.toLowerCase();
  if (producerA !== producerB) return producerA.localeCompare(producerB);
  const nameA = a.productName.toLowerCase();
  const nameB = b.productName.toLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return b.production_year - a.production_year || byVolume(a, b);
}

export function sortedStockForDocuments(rows: StockDocLot[]): StockDocLot[] {
  return [...rows].sort(sortDocLots);
}

/** « 2019 (2021) », « 2025 · 5 L » : année (et mise en bouteille), contenant hors bouteille standard. */
export function stockLotLabel(v: StockDocLot): string {
  const year = v.year != null && v.year !== v.production_year ? `${v.year} (${v.production_year})` : String(v.production_year);
  return withVolume(year, v, v.kind);
}
