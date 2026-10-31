-- Types de produit : le catalogue accueille l'huile d'olive à côté du vin, et demain d'autres produits.
-- Les tables gardent leur nom (wine = produit, wine_vintage = millésime ou récolte, grape = cépage ou
-- variété d'olive, wine_type = robe ou fruité) : ventes, stock, commandes, transports et dégustations
-- les référencent déjà et valent pour tous les types. Chaque produit porte son type (`kind`), comme les
-- référentiels qui lui sont propres : types, appellations, cépages / variétés.
-- Nouveau type de produit : l'ajouter au domaine ci-dessous et au registre src/lib/productKinds.ts.
-- Chaque lot reçoit aussi son contenant (volume_ml) : 50 cl, 5 L, magnum…, avec son prix et son stock.

CREATE DOMAIN public.product_kind AS text
  CONSTRAINT product_kind_check CHECK (VALUE IN ('wine', 'olive_oil'));

ALTER TABLE public.wine ADD COLUMN kind public.product_kind NOT NULL DEFAULT 'wine';
ALTER TABLE public.wine_type ADD COLUMN kind public.product_kind NOT NULL DEFAULT 'wine';
ALTER TABLE public.appelation ADD COLUMN kind public.product_kind NOT NULL DEFAULT 'wine';
ALTER TABLE public.grape ADD COLUMN kind public.product_kind NOT NULL DEFAULT 'wine';

CREATE INDEX IF NOT EXISTS wine_kind_idx ON public.wine (kind);

-- Un produit, son type, son appellation et ses cépages / variétés sont du même type de produit.
-- Contrôlé par trigger plutôt que par clé étrangère composite : une seconde clé de wine vers
-- wine_type rendrait ambiguës les jointures PostgREST `wine_type (*)` du code.
-- Chaque contrôle verrouille en partage (FOR SHARE) les lignes dont il lit le type : un changement de
-- type concurrent (prevent_kind_change_in_use, plus bas) attend sa fin puis voit la nouvelle ligne, et
-- inversement ; deux transactions simultanées ne peuvent pas contourner le contrôle. Les fonctions de
-- contrôle sont SECURITY DEFINER : FOR SHARE exige un droit de modification que l'admin n'a pas
-- forcément sur ces tables (wine_type), et le contrôle ne doit pas dépendre des policies RLS.
CREATE OR REPLACE FUNCTION public.check_wine_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM wine_type WHERE id = NEW.wine_type_id AND kind = NEW.kind FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce type (robe, fruité…) ne correspond pas au produit';
  END IF;
  IF NEW.appelation_id IS NOT NULL THEN
    PERFORM 1 FROM appelation WHERE id = NEW.appelation_id AND kind = NEW.kind FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette appellation ne correspond pas au produit (vin ou huile)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wine_kind_check
  BEFORE INSERT OR UPDATE OF kind, wine_type_id, appelation_id ON public.wine
  FOR EACH ROW EXECUTE FUNCTION public.check_wine_kind();

CREATE OR REPLACE FUNCTION public.check_vintage_grape_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
  FROM wine_vintage v
  JOIN wine w ON w.id = v.wine_id
  JOIN grape g ON g.id = NEW.grape_id
  WHERE v.id = NEW.wine_vintage_id AND g.kind = w.kind
  FOR SHARE OF v, w, g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce cépage ou cette variété ne correspond pas au produit (vin ou huile)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wine_vintage_grape_kind_check
  BEFORE INSERT OR UPDATE OF grape_id, wine_vintage_id ON public.wine_vintage_grape
  FOR EACH ROW EXECUTE FUNCTION public.check_vintage_grape_kind();

-- Un lot déplacé vers un autre produit garde des cépages / variétés du bon type. À la création d'un
-- lot, le verrou sur son produit empêche de changer le type de ce produit en même temps.
CREATE OR REPLACE FUNCTION public.check_vintage_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM wine WHERE id = NEW.wine_id FOR SHARE;
  PERFORM 1 FROM grape g JOIN wine_vintage_grape vg ON vg.grape_id = g.id WHERE vg.wine_vintage_id = NEW.id
  FOR SHARE OF g;
  IF EXISTS (
    SELECT 1
    FROM wine_vintage_grape vg
    JOIN grape g ON g.id = vg.grape_id
    WHERE vg.wine_vintage_id = NEW.id AND g.kind <> (SELECT kind FROM wine WHERE id = NEW.wine_id)
  ) THEN
    RAISE EXCEPTION 'Les cépages ou variétés de ce lot ne correspondent pas au produit (vin ou huile)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wine_vintage_kind_check
  BEFORE UPDATE OF wine_id ON public.wine_vintage
  FOR EACH ROW WHEN (OLD.wine_id IS DISTINCT FROM NEW.wine_id) EXECUTE FUNCTION public.check_vintage_kind();
CREATE TRIGGER wine_vintage_kind_lock
  BEFORE INSERT ON public.wine_vintage
  FOR EACH ROW EXECUTE FUNCTION public.check_vintage_kind();

-- Le type de produit d'une ligne déjà utilisée ne change plus : un produit qui a des millésimes, un
-- type, une appellation ou un cépage rattachés à des produits.
CREATE OR REPLACE FUNCTION public.prevent_kind_change_in_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_TABLE_NAME = 'wine' AND EXISTS (SELECT 1 FROM wine_vintage WHERE wine_id = NEW.id))
     OR (TG_TABLE_NAME = 'wine_type' AND EXISTS (SELECT 1 FROM wine WHERE wine_type_id = NEW.id))
     OR (TG_TABLE_NAME = 'appelation' AND EXISTS (SELECT 1 FROM wine WHERE appelation_id = NEW.id))
     OR (TG_TABLE_NAME = 'grape' AND EXISTS (SELECT 1 FROM wine_vintage_grape WHERE grape_id = NEW.id)) THEN
    RAISE EXCEPTION 'Déjà utilisé : son type de produit ne peut plus changer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wine_kind_locked BEFORE UPDATE OF kind ON public.wine
  FOR EACH ROW WHEN (OLD.kind IS DISTINCT FROM NEW.kind) EXECUTE FUNCTION public.prevent_kind_change_in_use();
CREATE TRIGGER wine_type_kind_locked BEFORE UPDATE OF kind ON public.wine_type
  FOR EACH ROW WHEN (OLD.kind IS DISTINCT FROM NEW.kind) EXECUTE FUNCTION public.prevent_kind_change_in_use();
CREATE TRIGGER appelation_kind_locked BEFORE UPDATE OF kind ON public.appelation
  FOR EACH ROW WHEN (OLD.kind IS DISTINCT FROM NEW.kind) EXECUTE FUNCTION public.prevent_kind_change_in_use();
CREATE TRIGGER grape_kind_locked BEFORE UPDATE OF kind ON public.grape
  FOR EACH ROW WHEN (OLD.kind IS DISTINCT FROM NEW.kind) EXECUTE FUNCTION public.prevent_kind_change_in_use();

-- Contenant : une même huile (ou un même vin, en magnum) se vend en plusieurs contenances, chacune
-- avec son prix d'achat, son prix de vente et son stock. Chaque contenant est donc un lot à part
-- (wine_vintage), ce que ventes, commandes, stock et dégustations référencent déjà. Les lots existants
-- sont des bouteilles de 75 cl.
ALTER TABLE public.wine_vintage
  ADD COLUMN volume_ml integer NOT NULL DEFAULT 750 CONSTRAINT wine_vintage_volume_ml_check CHECK (volume_ml > 0);

-- Un seul lot par produit, année et contenant (l'année de mise en bouteille pour un lot sans année),
-- comme le site les regroupe : pas de deux « 50 cl 2025 » d'une même huile.
CREATE UNIQUE INDEX wine_vintage_lot_key ON public.wine_vintage (wine_id, year, volume_ml) WHERE year IS NOT NULL;
CREATE UNIQUE INDEX wine_vintage_lot_without_year_key ON public.wine_vintage (wine_id, production_year, volume_ml)
  WHERE year IS NULL;

-- create_wine_vintage (20261024170000) reprend désormais le contenant de p_vintage.
CREATE OR REPLACE FUNCTION public.create_wine_vintage(
  p_vintage jsonb,
  p_source_id uuid DEFAULT NULL,
  p_copy_grapes boolean DEFAULT false,
  p_copy_notes boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v wine_vintage := jsonb_populate_record(NULL::wine_vintage, p_vintage);
  v_id uuid;
BEGIN
  PERFORM assert_admin();

  IF p_source_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM wine_vintage WHERE id = p_source_id AND wine_id = v.wine_id) THEN
    RAISE EXCEPTION 'Le millésime repris doit appartenir au même vin';
  END IF;

  INSERT INTO wine_vintage (wine_id, production_year, year, abv, price, image_url, organic, volume_ml)
  VALUES (v.wine_id, v.production_year, v.year, v.abv, v.price, v.image_url, coalesce(v.organic, false),
          coalesce(v.volume_ml, 750))
  RETURNING id INTO v_id;
  -- Prix d'achat obligatoire : non renseigné, on garde le défaut de la colonne.
  IF v.purchase_price IS NOT NULL THEN
    UPDATE wine_vintage SET purchase_price = v.purchase_price WHERE id = v_id;
  END IF;

  IF p_source_id IS NOT NULL AND p_copy_grapes THEN
    INSERT INTO wine_vintage_grape (wine_vintage_id, grape_id, percentage)
    SELECT v_id, grape_id, percentage FROM wine_vintage_grape WHERE wine_vintage_id = p_source_id;
  END IF;

  IF p_source_id IS NOT NULL AND p_copy_notes THEN
    INSERT INTO note (wine_vintage_id, type, content)
    SELECT v_id, type, content FROM note WHERE wine_vintage_id = p_source_id;
  END IF;

  RETURN v_id;
END;
$$;

-- TVA figée sur chaque ligne de vente, à son enregistrement : 6 % pour l'huile (alimentation), 21 %
-- pour le vin et les lignes sans lot (dégustation). Une facture déjà émise ne change plus si un lot
-- change de produit ou si un taux évolue. L'existant (vin et dégustations) est à 21 %.
CREATE OR REPLACE FUNCTION public.product_kind_vat_rate(p_kind public.product_kind)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE p_kind WHEN 'olive_oil' THEN 0.06 ELSE 0.21 END::numeric $$;

ALTER TABLE public.sale_item ADD COLUMN vat_rate numeric(4,3) NOT NULL DEFAULT 0.21;

CREATE OR REPLACE FUNCTION public.set_sale_item_vat_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.vat_rate := coalesce(
    (SELECT product_kind_vat_rate(w.kind) FROM wine_vintage v JOIN wine w ON w.id = v.wine_id WHERE v.id = NEW.wine_vintage_id),
    product_kind_vat_rate('wine')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER sale_item_vat_rate
  BEFORE INSERT OR UPDATE OF wine_vintage_id ON public.sale_item
  FOR EACH ROW EXECUTE FUNCTION public.set_sale_item_vat_rate();

-- Huile d'olive : intensité du fruité (l'équivalent de la robe), label DOP, les trois DOP oléicoles
-- des Abruzzes et les principales variétés d'olives de la région. Rien n'est recréé s'il existe déjà.
INSERT INTO public.wine_type (name, kind)
SELECT t.name, 'olive_oil'
FROM (VALUES ('Fruité léger'), ('Fruité moyen'), ('Fruité intense')) AS t(name)
WHERE NOT EXISTS (SELECT 1 FROM public.wine_type w WHERE w.kind = 'olive_oil' AND w.name = t.name);

INSERT INTO public.label (name, country_id)
SELECT 'DOP', (SELECT id FROM public.country WHERE upper(iso_code) = 'IT' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.label WHERE name = 'DOP');

INSERT INTO public.appelation (name, kind, label_id, region_id)
SELECT a.name, 'olive_oil',
  (SELECT id FROM public.label WHERE name = 'DOP' LIMIT 1),
  (SELECT id FROM public.region WHERE name = 'Abruzzo' LIMIT 1)
FROM (VALUES ('Aprutino Pescarese'), ('Colline Teatine'), ('Pretuziano delle Colline Teramane')) AS a(name)
WHERE NOT EXISTS (SELECT 1 FROM public.appelation x WHERE x.name = a.name);

INSERT INTO public.grape (name, kind)
SELECT g.name, 'olive_oil'
FROM (VALUES ('Dritta'), ('Leccino'), ('Intosso'), ('Gentile di Chieti'), ('Tortiglione'), ('Castiglionese'), ('Frantoio'))
  AS g(name)
WHERE NOT EXISTS (SELECT 1 FROM public.grape x WHERE x.name = g.name);
