import type { Database } from "./database.types";

export type Label = Database["public"]["Tables"]["label"]["Row"] & {
  country?: Country | null;
};
export type Country = Database["public"]["Tables"]["country"]["Row"];
export type Region = Database["public"]["Tables"]["region"]["Row"] & {
  country?: Country | null;
};
export type Producer = Database["public"]["Tables"]["producer"]["Row"] & {
  region?: Region | null;
  country?: Country | null;
};
export type Appellation = Database["public"]["Tables"]["appellation"]["Row"] & {
  label?: Label | null;
  region?: Region | null;
};
export type Product = Database["public"]["Tables"]["product"]["Row"] & {
  producer?: Producer | null;
  appellation?: Appellation | null;
  product_type?: ProductType | null;
};

export type LotVariety = Database["public"]["Tables"]["lot_variety"]["Row"] & {
  variety: Variety;
};
export type Note = Database["public"]["Tables"]["note"]["Row"];
export type Lot = Database["public"]["Tables"]["lot"]["Row"] & {
  lot_variety?: LotVariety[] | null;
  product?: Product | null;
  note?: Note[] | null;
};
export type Tasting = Database["public"]["Tables"]["tasting"]["Row"];
export type Customer = Database["public"]["Tables"]["customer"]["Row"] & {
  country?: Country | null;
};
export type ProductType = Database["public"]["Tables"]["product_type"]["Row"];
export type Variety = Database["public"]["Tables"]["variety"]["Row"];
export type StockMove = Database["public"]["Tables"]["stock_move"]["Row"];
