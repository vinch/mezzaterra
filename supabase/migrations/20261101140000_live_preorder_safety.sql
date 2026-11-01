-- Pré-commandes des invités et demandes « J'en veux » :
-- 1. save_live_preorder sérialise les appels d'un même invité et ne crée pas de seconde demande pour une
--    confirmation reçue deux fois ; un identifiant de lot mal formé est ignoré au lieu de faire échouer
--    tout le panier.
-- 2. L'insertion directe dans wish_request, gardée pour les pages live de l'ancien code (20261031200000),
--    est retirée : tout passe par save_live_preorder (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_confirm" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_raw jsonb := coalesce(p_items, '[]'::jsonb);
  v_confirm boolean := coalesce(p_confirm, false);
  v_items jsonb;
  v_draft live_preorder;
  v_id uuid;
BEGIN
  IF jsonb_path_exists(coalesce(p_items, '[]'::jsonb), '$[*] ? (!(exists(@.lot_id)))') THEN
    RAISE EXCEPTION 'Cette page date d''une ancienne version : rechargez-la.';
  END IF;
  IF p_tasting_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Dégustation ou invité manquant.';
  END IF;
  IF jsonb_typeof(v_raw) <> 'array' THEN
    RAISE EXCEPTION 'Pré-commande illisible.';
  END IF;
  -- Un invité à la fois : deux appels simultanés (double clic, deux onglets) passent l'un après l'autre.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tasting_id::text || ':' || p_guest_id::text, 0));
  -- Comme les notes, une pré-commande ne s'enregistre qu'autour de la soirée : pas de lignes laissées
  -- dans Piloter par n'importe qui à n'importe quelle date. La confirmation, elle, reste possible après.
  IF NOT v_confirm AND NOT EXISTS (
    SELECT 1 FROM tasting t WHERE t.id = p_tasting_id AND t.date BETWEEN current_date - 1 AND current_date + 1
  ) THEN
    RETURN NULL;
  END IF;

  -- Une ligne par produit de la dégustation, quantités entières de 1 à 60 ; le reste est ignoré.
  SELECT coalesce(jsonb_agg(jsonb_build_object('lot_id', l.vid, 'quantity', l.qty) ORDER BY l.vid), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT (e ->> 'lot_id')::uuid AS vid, least(sum((e ->> 'quantity')::int), 60) AS qty
    FROM jsonb_array_elements(v_raw) e
    WHERE (e ->> 'lot_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (e ->> 'quantity') ~ '^[0-9]{1,3}$'
      AND (e ->> 'quantity')::int > 0
    GROUP BY 1
  ) l
  WHERE EXISTS (
    SELECT 1 FROM tasting_lot tl WHERE tl.tasting_id = p_tasting_id AND tl.lot_id = l.vid
  );

  -- Confirmation déjà reçue (double clic, deuxième onglet) : la même demande, pas une seconde.
  IF v_confirm THEN
    SELECT w.id INTO v_id FROM wish_request w
    WHERE w.tasting_id = p_tasting_id AND w.guest_id = p_guest_id AND w.status = 'new'
      AND w.items = v_items AND w.created_at > now() - interval '2 minutes'
    ORDER BY w.created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
      DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;
      RETURN v_id;
    END IF;
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    IF v_confirm THEN
      RAISE EXCEPTION 'La pré-commande est vide.';
    END IF;
    DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;
    RETURN NULL;
  END IF;

  -- Coordonnées : celles du téléphone, qui les renvoie toutes à chaque fois (un champ vidé est effacé).
  INSERT INTO live_preorder (tasting_id, guest_id, first_name, last_name, email, phone, items)
  VALUES (
    p_tasting_id,
    p_guest_id,
    nullif(left(trim(coalesce(p_first_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_last_name, '')), 120), ''),
    nullif(left(lower(trim(coalesce(p_email, ''))), 200), ''),
    nullif(left(trim(coalesce(p_phone, '')), 60), ''),
    v_items
  )
  ON CONFLICT (tasting_id, guest_id) DO UPDATE SET
    items = EXCLUDED.items,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now()
  RETURNING * INTO v_draft;

  IF NOT v_confirm THEN
    RETURN NULL;
  END IF;

  -- Sans prénom ni contact, les contraintes de wish_request refusent la demande et tout est annulé.
  INSERT INTO wish_request (tasting_id, source, guest_id, first_name, last_name, email, phone, items)
  VALUES (p_tasting_id, 'live', p_guest_id, v_draft.first_name, v_draft.last_name, v_draft.email, v_draft.phone, v_draft.items)
  RETURNING id INTO v_id;
  DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;

  RETURN v_id;
END;
$_$;

DROP POLICY "anyone can request" ON public."wish_request";

NOTIFY pgrst, 'reload schema';
