import type { Database } from "./database.types";

export type Pairing = Database["public"]["Tables"]["pairing"]["Row"];
export type Label = Database["public"]["Tables"]["label"]["Row"];
export type Country = Database["public"]["Tables"]["country"]["Row"];
export type Region = Database["public"]["Tables"]["region"]["Row"] & {
  country: Country;
};
export type Winery = Database["public"]["Tables"]["winery"]["Row"] & {
  region?: Region;
  country?: Country;
};
export type Appelation = Database["public"]["Tables"]["appelation"]["Row"] & {
  label: Label;
};
export type Wine = Database["public"]["Tables"]["wine"]["Row"] & {
  winery: Winery;
  appelation: Appelation;
  wine_type: { name: string };
  wine_pairing: {
    wine: Wine;
    pairing: Pairing;
  }[];
};
export type WineVintageGrape =
  Database["public"]["Tables"]["wine_vintage_grape"]["Row"] & {
    grape: { name: string };
  };
export type Note = Database["public"]["Tables"]["note"]["Row"];
export type WineVintage =
  Database["public"]["Tables"]["wine_vintage"]["Row"] & {
    wine_vintage_grape: WineVintageGrape[];
    wine: Wine;
    note: Note[];
  };
export type Tasting = Database["public"]["Tables"]["tasting"]["Row"];
