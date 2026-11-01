-- Pré-commandes des invités et demandes « J'en veux » :
-- 1. save_live_preorder prend une clé de confirmation (p_request_key), tirée par le téléphone pour un
--    panier donné et renvoyée tant qu'il ne change pas : une confirmation reçue deux fois (double clic,
--    réponse perdue puis nouvel essai) renvoie la même demande au lieu d'en créer une seconde, et un simple
--    enregistrement qui suit une confirmation déjà reçue ne recrée pas de brouillon (les coordonnées
--    corrigées entre-temps sont reportées sur la demande) ; les appels d'un même invité passent l'un après l'autre ; un identifiant de lot mal formé est
--    ignoré au lieu de faire échouer tout le panier ; un panier illisible est signalé comme tel.
-- 2. L'insertion directe dans wish_request, gardée pour les pages live de l'ancien code (20261031200000),
--    est retirée : tout passe par save_live_preorder (SECURITY DEFINER).

ALTER TABLE public."wish_request" ADD COLUMN "request_key" uuid;
CREATE UNIQUE INDEX "wish_request_request_key" ON public."wish_request" ("request_key");

-- Nouveau paramètre (avec valeur par défaut) : la fonction est recréée, avec ses droits d'origine.
DROP FUNCTION public."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean);
CREATE FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_confirm" boolean DEFAULT false, "p_request_key" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_raw jsonb := coalesce(p_items, '[]'::jsonb);
  v_confirm boolean := coalesce(p_confirm, false);
  v_items jsonb;
  v_draft live_preorder;
  v_id uuid;
  v_same_guest boolean;
  v_key uuid := p_request_key;
BEGIN
  IF p_tasting_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Dégustation ou invité manquant.';
  END IF;
  IF jsonb_typeof(v_raw) <> 'array' THEN
    RAISE EXCEPTION 'Pré-commande illisible.';
  END IF;
  IF jsonb_path_exists(v_raw, 'strict $[*] ? (@.type() != "object")') THEN
    RAISE EXCEPTION 'Pré-commande illisible.';
  END IF;
  IF jsonb_path_exists(v_raw, '$[*] ? (!(exists(@.lot_id)))') THEN
    RAISE EXCEPTION 'Cette page date d''une ancienne version : rechargez-la.';
  END IF;
  -- Un invité à la fois : deux appels simultanés (double clic, deux onglets) passent l'un après l'autre.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tasting_id::text || ':' || p_guest_id::text, 0));

  -- Confirmation déjà reçue pour ce panier (double clic, réponse perdue puis nouvel essai, enregistrement
  -- qui la suit) : la même demande, sans second brouillon ; les coordonnées corrigées y sont reportées.
  IF v_key IS NOT NULL THEN
    SELECT w.id, (w.tasting_id = p_tasting_id AND w.guest_id = p_guest_id) INTO v_id, v_same_guest
    FROM wish_request w WHERE w.request_key = v_key;
    IF v_id IS NOT NULL AND v_same_guest THEN
      UPDATE wish_request SET
        first_name = coalesce(nullif(left(trim(coalesce(p_first_name, '')), 120), ''), first_name),
        last_name = coalesce(nullif(left(trim(coalesce(p_last_name, '')), 120), ''), last_name),
        email = coalesce(nullif(left(lower(trim(coalesce(p_email, ''))), 200), ''), email),
        phone = coalesce(nullif(left(trim(coalesce(p_phone, '')), 60), ''), phone)
      WHERE id = v_id AND status = 'new';
      DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;
      RETURN v_id;
    END IF;
    -- Clé déjà prise ailleurs (cas anormal) : ignorée plutôt que de bloquer toutes les confirmations.
    IF v_id IS NOT NULL THEN
      v_key := NULL;
    END IF;
    v_id := NULL;
  END IF;
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
    WHERE pg_input_is_valid(e ->> 'lot_id', 'uuid')
      AND (e ->> 'quantity') ~ '^[0-9]{1,3}$'
      AND (e ->> 'quantity')::int > 0
    GROUP BY 1
  ) l
  WHERE EXISTS (
    SELECT 1 FROM tasting_lot tl WHERE tl.tasting_id = p_tasting_id AND tl.lot_id = l.vid
  );

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
  INSERT INTO wish_request (tasting_id, source, guest_id, first_name, last_name, email, phone, items, request_key)
  VALUES (p_tasting_id, 'live', p_guest_id, v_draft.first_name, v_draft.last_name, v_draft.email, v_draft.phone, v_draft.items, v_key)
  RETURNING id INTO v_id;
  DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;

  RETURN v_id;
END;
$_$;

ALTER FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean, "p_request_key" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean, "p_request_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean, "p_request_key" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean, "p_request_key" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_confirm" boolean, "p_request_key" "uuid") TO "service_role";

DROP POLICY IF EXISTS "anyone can request" ON public."wish_request";

NOTIFY pgrst, 'reload schema';
