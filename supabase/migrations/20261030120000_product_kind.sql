-- Types de produit : le catalogue accueille l'huile d'olive à côté du vin, et demain d'autres produits.
-- Les tables gardent leur nom (wine = produit, wine_vintage = millésime ou récolte, grape = cépage ou
-- variété d'olive, wine_type = robe ou fruité) : ventes, stock, commandes, transports et dégustations
-- les référencent déjà et valent pour tous les types. Chaque produit porte son type (`kind`), comme les
-- référentiels qui lui sont propres : types, appellations, cépages / variétés.
-- Nouveau type de produit : l'ajouter au domaine ci-dessous et au registre src/lib/productKinds.ts.

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
CREATE OR REPLACE FUNCTION public.check_wine_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wine_type WHERE id = NEW.wine_type_id AND kind = NEW.kind) THEN
    RAISE EXCEPTION 'Ce type (robe, fruité…) ne correspond pas au produit';
  END IF;
  IF NEW.appelation_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM appelation WHERE id = NEW.appelation_id AND kind = NEW.kind) THEN
    RAISE EXCEPTION 'Cette appellation ne correspond pas au produit (vin ou huile)';
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
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM wine_vintage v
    JOIN wine w ON w.id = v.wine_id
    JOIN grape g ON g.id = NEW.grape_id
    WHERE v.id = NEW.wine_vintage_id AND g.kind = w.kind
  ) THEN
    RAISE EXCEPTION 'Ce cépage ou cette variété ne correspond pas au produit (vin ou huile)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wine_vintage_grape_kind_check
  BEFORE INSERT OR UPDATE OF grape_id, wine_vintage_id ON public.wine_vintage_grape
  FOR EACH ROW EXECUTE FUNCTION public.check_vintage_grape_kind();

-- Le type de produit d'une ligne déjà utilisée ne change plus : un produit qui a des millésimes, un
-- type, une appellation ou un cépage rattachés à des produits.
CREATE OR REPLACE FUNCTION public.prevent_kind_change_in_use()
RETURNS trigger
LANGUAGE plpgsql
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
WHERE NOT EXISTS (SELECT 1 FROM public.appelation x WHERE x.kind = 'olive_oil' AND x.name = a.name);

INSERT INTO public.grape (name, kind)
SELECT g.name, 'olive_oil'
FROM (VALUES ('Dritta'), ('Leccino'), ('Intosso'), ('Gentile di Chieti'), ('Tortiglione'), ('Castiglionese'), ('Frantoio'))
  AS g(name)
WHERE NOT EXISTS (SELECT 1 FROM public.grape x WHERE x.kind = 'olive_oil' AND x.name = g.name);
