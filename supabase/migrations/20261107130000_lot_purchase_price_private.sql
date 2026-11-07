-- Prix d'achat invisibles des visiteurs : la clé publique du site (rôle anon) ne lit plus que les
-- colonnes publiques de lot. Un droit SELECT sur la table couvre toutes ses colonnes, présentes et
-- futures : on le retire, puis on accorde les colonnes une à une.
-- Le site liste donc ses colonnes (LOT_PUBLIC_COLUMNS, src/lib/products.ts) : un select=* de anon
-- sur lot échoue. Une nouvelle colonne publique de lot s'ajoute ici et dans LOT_PUBLIC_COLUMNS.
-- Le rôle authenticated garde tous ses droits : tout compte connecté, admin ou non, lit les prix
-- d'achat. Les inscriptions doivent donc rester fermées (voir le README).
-- Retour arrière : GRANT SELECT ON public.lot TO anon;

REVOKE SELECT ON public.lot FROM anon;
GRANT SELECT (id, product_id, year, production_year, volume_ml, abv, price, image_url, organic, discontinued_at, created_at)
  ON public.lot TO anon;

-- Un REVOKE sans effet (droit accordé par un autre rôle, ou via PUBLIC) ne lève qu'un avertissement :
-- on vérifie le résultat.
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.lot', 'purchase_price', 'SELECT') THEN
    RAISE EXCEPTION 'anon lit encore lot.purchase_price';
  END IF;
END $$;
