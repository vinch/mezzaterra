-- Prix d'achat invisibles des visiteurs : la clé publique du site (rôle anon) ne lit plus que les
-- colonnes publiques de lot. Un droit SELECT sur la table couvre toutes ses colonnes, présentes et
-- futures : on le retire, puis on accorde les colonnes une à une.
-- Le site liste donc ses colonnes (LOT_PUBLIC_COLUMNS, src/lib/products.ts) : un select=* de anon
-- sur lot échoue. Une nouvelle colonne publique de lot s'ajoute ici et dans LOT_PUBLIC_COLUMNS.
-- La gestion (rôle authenticated) garde tous ses droits.
-- Retour arrière : GRANT SELECT ON public.lot TO anon;

REVOKE SELECT ON public.lot FROM anon;
GRANT SELECT (id, product_id, year, production_year, volume_ml, abv, price, image_url, organic, discontinued_at, created_at)
  ON public.lot TO anon;
