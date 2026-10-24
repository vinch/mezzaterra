-- Nouveau millésime : création et reprise des cépages et notes de dégustation d'un autre millésime du
-- même vin, en une transaction. L'image est reprise côté formulaire (champ image_url de p_vintage) ;
-- les accords mets-vins sont rattachés au vin et valent déjà pour tous ses millésimes.
-- Droits de l'appelant (RLS appliquée), réservé aux administrateurs comme les autres fonctions d'écriture.

-- Les notes n'étaient écrites que depuis le tableau de bord Supabase : écriture admin si elle manque.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'note' AND policyname = 'admins can insert'
  ) THEN
    CREATE POLICY "admins can insert" ON public.note FOR INSERT WITH CHECK (is_admin());
  END IF;
END;
$$;

-- p_vintage : colonnes de wine_vintage (wine_id, production_year, year, abv, purchase_price, price,
-- image_url, organic) ; p_source_id : millésime du même vin dont on reprend cépages et/ou notes.
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

  INSERT INTO wine_vintage (wine_id, production_year, year, abv, price, image_url, organic)
  VALUES (v.wine_id, v.production_year, v.year, v.abv, v.price, v.image_url, coalesce(v.organic, false))
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
