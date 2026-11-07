import { fetchAllRows, supabase } from "./supabase";
import { addDaysIso, formatShortMonth, parseIsoDate, todayIso } from "./dates";
import { formatEUR, toNumber, toNumberOrNull } from "./format";
import { fetchStockMap } from "./manageData";
import { quantitiesByLot } from "./sales";

/**
 * Calculs de pilotage (marges, rotation du stock, rentabilité des dégustations).
 * Tout est calculé côté client : les volumes sont modestes et ça évite toute migration.
 *
 * Coût d'une bouteille = coût de revient (unitCost) : prix d'achat + part du transport qui l'a amenée
 * (lot.freight, voir freightByLot). Marges, valeur du stock et bouteilles ouvertes en dégustation
 * l'utilisent tous.
 */

/** Statuts qui comptent dans le CA (aligné sur le tableau de bord et l'app ventes). */
export const REVENUE_STATUSES = ["paid", "delivered", "closed"];

/** Hypothèse : une bouteille ouverte par lot servi en dégustation. */
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
  /** null : prix inconnu, hors marge ; 0 : produit reçu gratuitement. */
  purchase_price: number | null;
  /** Transport par bouteille (freightByLot), ajouté par loadDataset ; 0 sans transport enregistré. */
  freight: number;
  image_url: string | null;
  discontinued_at?: string | null;
  product: any;
};

/** Transport avec les bouteilles qu'il a amenées (lignes de ses commandes fournisseur). */
export type TransportRow = {
  price: number | null;
  order: { order_item: { lot_id: string; quantity: number }[] }[];
};

/** Transports dont le prix entre dans le coût de revient : la marchandise est partie. */
const FREIGHT_STATUSES = ["in_transit", "delivered"];

export type Dataset = {
  sales: SaleRow[];
  items: SaleItemRow[];
  lots: LotRow[];
  stock: Map<string, number>;
  /** Transports en transit ou livrés sans prix : leur part n'est pas comptée (voir freightByLot). */
  unpricedTransports: number;
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
  const [sales, items, lots, stock, transports] = await Promise.all([
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
    fetchAllRows<Omit<LotRow, "freight">>((a, b) =>
      supabase
        .from("lot")
        .select(
          "*, product ( id, name, producer ( id, name ), appellation ( name, label ( name ) ), product_type ( name, category, kind ) )",
        )
        .order("id")
        .range(a, b),
    ),
    fetchStockMap(),
    fetchAllRows<TransportRow>((a, b) =>
      supabase
        .from("transport")
        .select("price, order ( order_item ( lot_id, quantity ) )")
        .in("status", FREIGHT_STATUSES)
        .order("id")
        .range(a, b),
    ),
  ]);
  const freight = freightByLot(transports);
  return {
    sales,
    items,
    lots: lots.map((l) => ({ ...l, freight: freight.get(l.id) ?? 0 })),
    stock,
    unpricedTransports: transports.filter((t) => t.price == null).length,
  };
}

/**
 * Transport par bouteille de chaque lot : le prix d'un transport est réparti à parts égales entre les
 * bouteilles de ses commandes, puis moyenné par lot s'il est venu en plusieurs fois. Un transport sans
 * prix est ignoré : ses bouteilles prennent la moyenne des autres transports du lot, ou 0.
 */
function freightByLot(transports: TransportRow[]): Map<string, number> {
  const totals = new Map<string, { cost: number; bottles: number }>();
  for (const t of transports) {
    const price = toNumberOrNull(t.price);
    if (price == null) continue;
    const perLot = quantitiesByLot(t.order.flatMap((o) => o.order_item));
    const bottles = [...perLot.values()].reduce((s, q) => s + q, 0);
    if (bottles <= 0) continue;
    for (const [lotId, qty] of perLot) {
      if (qty <= 0) continue;
      const lot = totals.get(lotId) ?? { cost: 0, bottles: 0 };
      lot.cost += (price / bottles) * qty;
      lot.bottles += qty;
      totals.set(lotId, lot);
    }
  }
  return new Map([...totals].map(([id, t]) => [id, t.cost / t.bottles]));
}

/** Coût de revient d'une bouteille : prix d'achat + transport ; null si le prix d'achat est inconnu (hors marge). */
function unitCost(lot: Pick<LotRow, "purchase_price" | "freight">): number | null {
  const buy = toNumberOrNull(lot.purchase_price);
  return buy == null ? null : buy + lot.freight;
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
  /** Coût de revient (0 pour les lignes dégustation) ; null si le lot n'a pas de prix d'achat : la ligne reste hors marge. */
  cost: number | null;
  /** Part du transport dans `cost`. */
  freight: number;
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
      const cost = v ? unitCost(v) : null;
      const quantity = Number(it.quantity) || 0;
      out.push({
        saleId,
        date: sale.date,
        customerId: sale.customer_id,
        tastingId: sale.tasting_id ?? null,
        lotId: it.lot_id,
        isTastingFee: !it.lot_id,
        quantity,
        revenue: lineTotal(it) * factor,
        cost: !it.lot_id ? 0 : cost != null ? cost * quantity : null,
        freight: v && cost != null ? v.freight * quantity : 0,
      });
    }
  }
  return out;
}

export type MarginSummary = {
  margin: number;
  /** Transport des bouteilles vendues, compris dans le coût de revient déduit. */
  freight: number;
  /** Taux de marge en %, sur le CA des seules lignes dont le prix d'achat est connu ; null sans CA. */
  pct: number | null;
  /** Lots vendus sans prix d'achat, laissés hors marge (leur marge vaudrait tout leur CA). */
  uncostedLots: number;
};

/** « 2 lots sans prix d'achat, hors marge » : mention sous un indicateur de marge. */
export function uncostedLabel(n: number): string {
  return `${n} lot${n > 1 ? "s" : ""} sans prix d’achat, hors marge`;
}

/** « Coût de revient déduit, dont 120 € de transport » : mention sous un indicateur de marge. */
export function freightLabel(amount: number): string {
  return `Coût de revient déduit, dont ${formatEUR(amount)} de transport`;
}

/** « 2 transports sans prix, non comptés » : mention sous un indicateur de marge ou de stock. */
export function unpricedTransportLabel(n: number): string {
  return `${n} transport${n > 1 ? "s" : ""} sans prix, non compté${n > 1 ? "s" : ""}`;
}

/** Marge des ventes de produits (entrées de dégustation ignorées) : CA − coût de revient, lignes au prix d'achat connu seulement. */
export function marginOf(lines: RevenueLine[]): MarginSummary {
  let revenue = 0;
  let cost = 0;
  let freight = 0;
  const uncosted = new Set<string | null>();
  for (const l of lines) {
    if (l.isTastingFee) continue;
    if (l.cost == null) uncosted.add(l.lotId);
    else {
      revenue += l.revenue;
      cost += l.cost;
      freight += l.freight;
    }
  }
  const margin = revenue - cost;
  return { margin, freight, pct: revenue > 0 ? (margin / revenue) * 100 : null, uncostedLots: uncosted.size };
}

export type LotStats = {
  lot: LotRow;
  stock: number;
  sold: number;
  revenue: number;
  /** Marge réalisée ; null sans prix d'achat (voir marginOf). */
  margin: number | null;
  /** Taux de marge réalisé (marge / CA, en %) ; null sans prix d'achat ou sans CA. */
  marginPct: number | null;
  /** Marge unitaire théorique : prix catalogue − coût de revient. */
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
    const lastSale = own.reduce<string | null>((m, l) => (!m || l.date > m ? l.date : m), null);
    const price = v.price != null ? toNumber(v.price) : null;
    const cost = unitCost(v);
    const unitMargin = price != null && cost != null ? price - cost : null;
    const realized = marginOf(own);
    return {
      lot: v,
      stock: ds.stock.get(v.id) ?? 0,
      sold: own.reduce((s, l) => s + l.quantity, 0),
      revenue,
      margin: cost == null ? null : realized.margin,
      marginPct: cost == null ? null : realized.pct,
      unitMargin,
      unitMarginPct: unitMargin != null && price ? (unitMargin / price) * 100 : null,
      lastSale,
      idleDays: lastSale ? Math.round((today - parseIsoDate(lastSale).getTime()) / 86_400_000) : null,
    };
  });
}

/** Valeur au coût de revient de `qty` bouteilles d'un lot ; null si le prix d'achat est inconnu. */
export function costValue(lot: Pick<LotRow, "purchase_price" | "freight">, qty: number): number | null {
  const cost = unitCost(lot);
  return cost == null ? null : cost * qty;
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
  /** Coût de revient des bouteilles ouvertes. */
  pouredCost: number;
  /** Lignes « Dégustation » (entrées) des ventes de la soirée. */
  fees: number;
  /** Ventes de produits rattachées à la soirée (sale.tasting_id). */
  eveningRevenue: number;
  eveningMargin: number;
  eveningBottles: number;
  /** Clients ayant acheté des produits pendant la soirée. */
  buyers: number;
  /** Ventes de produits aux participants dans les N jours qui suivent, hors soirée (relances). */
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
      (s, w) => {
        const lot = lots.get(w.lot_id);
        return s + ((lot && costValue(lot, BOTTLES_PER_TASTED_LOT)) ?? 0);
      },
      0,
    );
    const evening = linesByTasting.get(t.id) ?? [];
    const fees = evening.filter((l) => l.isTastingFee).reduce((s, l) => s + l.revenue, 0);
    const productLines = evening.filter((l) => !l.isTastingFee);
    const eveningRevenue = productLines.reduce((s, l) => s + l.revenue, 0);
    const eveningMargin = marginOf(evening).margin;
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
