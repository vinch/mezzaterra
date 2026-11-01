import { fetchAllRows, supabase } from "./supabase";
import { addDaysIso, formatShortMonth, parseIsoDate, todayIso } from "./dates";
import { toNumber } from "./format";
import { fetchStockMap } from "./manageData";

/**
 * Calculs de pilotage (marges, rotation du stock, rentabilité des dégustations).
 * Tout est calculé côté client : les volumes sont modestes et ça évite toute migration.
 */

/** Statuts qui comptent dans le CA (aligné sur le tableau de bord et l'app ventes). */
export const REVENUE_STATUSES = ["paid", "delivered", "closed"];

/** Hypothèse : une bouteille ouverte par vin servi en dégustation. */
export const BOTTLES_PER_TASTED_LOT = 1;

export type SaleRow = {
  id: string;
  date: string;
  status: string;
  total_price: number;
  customer_id: string;
  /** Dégustation pendant laquelle la vente a été conclue. */
  tasting_id?: string | null;
};

export type SaleItemRow = {
  id: string;
  sale_id: string;
  lot_id: string | null;
  quantity: number;
  price: number;
  discount: number | null;
  discount_type: string | null;
  note: string | null;
};

export type LotRow = {
  id: string;
  product_id: string;
  year: number | null;
  production_year: number;
  price: number | null;
  purchase_price: number;
  image_url: string | null;
  discontinued_at?: string | null;
  product: any;
};

export type Dataset = {
  sales: SaleRow[];
  items: SaleItemRow[];
  lots: LotRow[];
  stock: Map<string, number>;
};

/** Regroupe une liste par clé (les éléments sans clé sont ignorés), en un seul passage. */
function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export async function loadDataset(): Promise<Dataset> {
  const [sales, items, lots, stock] = await Promise.all([
    fetchAllRows<SaleRow>((a, b) =>
      supabase.from("sale").select("id, date, status, total_price, customer_id, tasting_id").order("id").range(a, b),
    ),
    fetchAllRows<SaleItemRow>((a, b) =>
      supabase
        .from("sale_item")
        .select("id, sale_id, lot_id, quantity, price, discount, discount_type, note")
        .order("id")
        .range(a, b),
    ),
    fetchAllRows<LotRow>((a, b) =>
      supabase
        .from("lot")
        .select(
          "*, product ( id, name, producer ( id, name ), appellation ( name, label ( name ) ), product_type ( name, category, kind ) )",
        )
        .order("id")
        .range(a, b),
    ),
    fetchStockMap(),
  ]);
  return { sales, items, lots, stock };
}

/** Total d'une ligne après remise (même règle que /manage/sales), jamais négatif. */
export function lineTotal(item: Pick<SaleItemRow, "price" | "quantity" | "discount" | "discount_type">): number {
  let t = toNumber(item.price) * (Number(item.quantity) || 0);
  const d = toNumber(item.discount);
  const kind = String(item.discount_type ?? "").toLowerCase();
  if (d > 0) {
    if (kind === "percent") t *= 1 - d / 100;
    else if (kind === "amount") t -= d;
  }
  return Math.max(0, Math.round(t * 100) / 100);
}

export type RevenueLine = {
  saleId: string;
  date: string;
  customerId: string;
  tastingId: string | null;
  lotId: string | null;
  isTastingFee: boolean;
  quantity: number;
  /** CA de la ligne après remise de ligne ET ristourne globale (proratisée). */
  revenue: number;
  /** Coût d'achat (0 pour les lignes dégustation). */
  cost: number;
};

export function revenueLines(ds: Dataset, statuses = REVENUE_STATUSES): RevenueLine[] {
  const salesById = new Map(ds.sales.map((s) => [s.id, s]));
  const lots = new Map(ds.lots.map((v) => [v.id, v]));
  const itemsBySale = groupBy(ds.items, (it) => it.sale_id);

  const out: RevenueLine[] = [];
  for (const [saleId, items] of itemsBySale) {
    const sale = salesById.get(saleId);
    if (!sale || !statuses.includes(sale.status)) continue;
    const gross = items.reduce((s, it) => s + lineTotal(it), 0);
    const factor = gross > 0 ? toNumber(sale.total_price) / gross : 1;
    for (const it of items) {
      const v = it.lot_id ? lots.get(it.lot_id) : null;
      out.push({
        saleId,
        date: sale.date,
        customerId: sale.customer_id,
        tastingId: sale.tasting_id ?? null,
        lotId: it.lot_id,
        isTastingFee: !it.lot_id,
        quantity: Number(it.quantity) || 0,
        revenue: lineTotal(it) * factor,
        cost: v ? toNumber(v.purchase_price) * (Number(it.quantity) || 0) : 0,
      });
    }
  }
  return out;
}

export type LotStats = {
  lot: LotRow;
  stock: number;
  sold: number;
  revenue: number;
  cost: number;
  margin: number;
  /** Marge unitaire théorique au prix catalogue. */
  unitMargin: number | null;
  unitMarginPct: number | null;
  lastSale: string | null;
  /** Jours depuis la dernière vente (ou depuis la création si jamais vendu). */
  idleDays: number | null;
};

export function lotStats(ds: Dataset, lines = revenueLines(ds)): LotStats[] {
  const today = parseIsoDate(todayIso()).getTime();
  const linesByLot = groupBy(lines, (l) => l.lotId);
  return ds.lots.map((v) => {
    const own = linesByLot.get(v.id) ?? [];
    const revenue = own.reduce((s, l) => s + l.revenue, 0);
    const cost = own.reduce((s, l) => s + l.cost, 0);
    const lastSale = own.reduce<string | null>((m, l) => (!m || l.date > m ? l.date : m), null);
    const price = v.price != null ? toNumber(v.price) : null;
    const buy = toNumber(v.purchase_price);
    const unitMargin = price != null && buy > 0 ? price - buy : null;
    return {
      lot: v,
      stock: ds.stock.get(v.id) ?? 0,
      sold: own.reduce((s, l) => s + l.quantity, 0),
      revenue,
      cost,
      margin: revenue - cost,
      unitMargin,
      unitMarginPct: unitMargin != null && price ? (unitMargin / price) * 100 : null,
      lastSale,
      idleDays: lastSale ? Math.round((today - parseIsoDate(lastSale).getTime()) / 86_400_000) : null,
    };
  });
}

/** CA mensuel (12 derniers mois glissants, mois courant inclus). */
export function monthlyRevenue(ds: Dataset, months = 12): { key: string; label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: formatShortMonth(d),
      value: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const s of ds.sales) {
    if (!REVENUE_STATUSES.includes(s.status)) continue;
    const i = index.get(s.date.slice(0, 7));
    if (i != null) buckets[i].value += toNumber(s.total_price);
  }
  return buckets;
}

export type TastingRoi = {
  tasting: { id: string; name: string | null; date: string; location: string | null };
  participants: number;
  lotsPoured: number;
  /** Coût d'achat des bouteilles ouvertes. */
  pouredCost: number;
  /** Lignes « Dégustation » (entrées) des ventes de la soirée. */
  fees: number;
  /** Ventes de vin rattachées à la soirée (sale.tasting_id). */
  eveningRevenue: number;
  eveningMargin: number;
  eveningBottles: number;
  /** Clients ayant acheté du vin pendant la soirée. */
  buyers: number;
  /** Ventes de vin aux participants dans les N jours qui suivent, hors soirée (relances). */
  laterRevenue: number;
  /** Entrées + marge des ventes de la soirée − bouteilles ouvertes. */
  result: number;
};

export async function tastingRoi(ds: Dataset, lines = revenueLines(ds), windowDays = 30): Promise<TastingRoi[]> {
  const { data, error } = await supabase
    .from("tasting")
    .select("id, name, date, location, tasting_customer ( customer_id ), tasting_lot ( lot_id )")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);

  const lots = new Map(ds.lots.map((v) => [v.id, v]));
  const linesByTasting = groupBy(lines, (l) => l.tastingId);
  return ((data || []) as any[]).map((t) => {
    const customers = new Set<string>((t.tasting_customer || []).map((r: any) => r.customer_id));
    const tastingLots = (t.tasting_lot || []) as { lot_id: string }[];
    const pouredCost = tastingLots.reduce(
      (s, w) => s + toNumber(lots.get(w.lot_id)?.purchase_price) * BOTTLES_PER_TASTED_LOT,
      0,
    );
    const evening = linesByTasting.get(t.id) ?? [];
    const fees = evening.filter((l) => l.isTastingFee).reduce((s, l) => s + l.revenue, 0);
    const productLines = evening.filter((l) => !l.isTastingFee);
    const eveningRevenue = productLines.reduce((s, l) => s + l.revenue, 0);
    const eveningMargin = productLines.reduce((s, l) => s + (l.revenue - l.cost), 0);
    const end = addDaysIso(t.date, windowDays);
    const later = lines.filter(
      (l) => !l.isTastingFee && !l.tastingId && customers.has(l.customerId) && l.date > t.date && l.date <= end,
    );
    return {
      tasting: { id: t.id, name: t.name, date: t.date, location: t.location },
      participants: customers.size,
      lotsPoured: tastingLots.length,
      pouredCost,
      fees,
      eveningRevenue,
      eveningMargin,
      eveningBottles: productLines.reduce((s, l) => s + l.quantity, 0),
      buyers: new Set(productLines.map((l) => l.customerId)).size,
      laterRevenue: later.reduce((s, l) => s + l.revenue, 0),
      result: fees + eveningMargin - pouredCost,
    };
  });
}
