import type { Database } from "./database.types";

export type Pairing = Database["public"]["Tables"]["pairing"]["Row"];
export type Label = Database["public"]["Tables"]["label"]["Row"] & {
  country?: Country | null;
};
export type Country = Database["public"]["Tables"]["country"]["Row"];
export type Region = Database["public"]["Tables"]["region"]["Row"] & {
  country?: Country | null;
};
export type Winery = Database["public"]["Tables"]["winery"]["Row"] & {
  region?: Region | null;
  country?: Country | null;
};
export type Appelation = Database["public"]["Tables"]["appelation"]["Row"] & {
  label?: Label | null;
  region?: Region | null;
};
export type Wine = Database["public"]["Tables"]["wine"]["Row"] & {
  winery?: Winery | null;
  appelation?: Appelation | null;
  wine_type?: WineType | null;
};

export type WinePairing =
  Database["public"]["Tables"]["wine_pairing"]["Row"] & {
    wine: Wine;
    pairing: Pairing;
  };
export type WineVintageGrape =
  Database["public"]["Tables"]["wine_vintage_grape"]["Row"] & {
    grape: Grape;
  };
export type Note = Database["public"]["Tables"]["note"]["Row"];
export type WineVintage =
  Database["public"]["Tables"]["wine_vintage"]["Row"] & {
    wine_vintage_grape?: WineVintageGrape[] | null;
    wine?: Wine | null;
    note?: Note[] | null;
  };
export type Tasting = Database["public"]["Tables"]["tasting"]["Row"];
export type Customer = Database["public"]["Tables"]["customer"]["Row"] & {
  country?: Country | null;
};
export type WineType = Database["public"]["Tables"]["wine_type"]["Row"];
export type Grape = Database["public"]["Tables"]["grape"]["Row"];
export type StockMove = Database["public"]["Tables"]["stock_move"]["Row"];
