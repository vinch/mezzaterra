-- Renommage du modèle « vin » en modèle « produit » (vins, huiles d'olive…), une fois pour toutes.
-- Tables, colonnes, contraintes, index, triggers, fonctions et vue inventory. Aucune donnée n'est
-- copiée ni supprimée : ALTER … RENAME ne touche qu'aux noms ; la CLI applique le fichier dans une seule
-- transaction. Seule écriture : la clé du lot dans le JSON des demandes et pré-commandes (section 9).
-- Le type de produit 'wine' (domaine product_kind) ne change pas.
-- Script inverse : supabase/rollback/20261101120000_rename_products_down.sql.


-- 1. Tables
ALTER TABLE public."tasting_wine_vintage" RENAME TO "tasting_lot";
ALTER TABLE public."wine_vintage_grape" RENAME TO "lot_variety";
ALTER TABLE public."wine_vintage" RENAME TO "lot";
ALTER TABLE public."wine_type" RENAME TO "product_type";
ALTER TABLE public."wine_pairing" RENAME TO "product_pairing";
ALTER TABLE public."wine" RENAME TO "product";
ALTER TABLE public."grape" RENAME TO "variety";
ALTER TABLE public."winery" RENAME TO "producer";
ALTER TABLE public."appelation" RENAME TO "appellation";

-- 2. Colonnes
ALTER TABLE public."stock_move" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."note" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."order_item" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."sale_item" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."tasting_feedback" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."tasting_lot" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."product" RENAME COLUMN "wine_type_id" TO "product_type_id";
ALTER TABLE public."product" RENAME COLUMN "winery_id" TO "producer_id";
ALTER TABLE public."product" RENAME COLUMN "appelation_id" TO "appellation_id";
ALTER TABLE public."product_pairing" RENAME COLUMN "wine_id" TO "product_id";
ALTER TABLE public."lot" RENAME COLUMN "wine_id" TO "product_id";
ALTER TABLE public."lot_variety" RENAME COLUMN "wine_vintage_id" TO "lot_id";
ALTER TABLE public."lot_variety" RENAME COLUMN "grape_id" TO "variety_id";

-- 3. Contraintes et index (noms hérités, souvent au pluriel)
ALTER TABLE public."appellation" RENAME CONSTRAINT "appelations_pkey" TO "appellation_pkey";
ALTER TABLE public."variety" RENAME CONSTRAINT "grapes_pkey" TO "variety_pkey";
ALTER TABLE public."tasting_lot" RENAME CONSTRAINT "tastings_wine_vintages_pkey" TO "tasting_lot_pkey";
ALTER TABLE public."note" RENAME CONSTRAINT "wine_tasting_notes_pkey" TO "note_pkey";
ALTER TABLE public."product_type" RENAME CONSTRAINT "wine_types_pkey" TO "product_type_pkey";
ALTER TABLE public."lot" RENAME CONSTRAINT "wine_vintages_pkey" TO "lot_pkey";
ALTER TABLE public."producer" RENAME CONSTRAINT "wineries_pkey" TO "producer_pkey";
ALTER TABLE public."lot_variety" RENAME CONSTRAINT "wines_grapes_pkey" TO "lot_variety_pkey";
ALTER TABLE public."product_pairing" RENAME CONSTRAINT "wines_pairings_pkey" TO "product_pairing_pkey";
ALTER TABLE public."product" RENAME CONSTRAINT "wines_pkey" TO "product_pkey";
ALTER TABLE public."appellation" RENAME CONSTRAINT "appelations_label_id_fkey" TO "appellation_label_id_fkey";
ALTER TABLE public."appellation" RENAME CONSTRAINT "appelations_region_id_fkey" TO "appellation_region_id_fkey";
ALTER TABLE public."order_item" RENAME CONSTRAINT "order_item_wine_vintage_id_fkey" TO "order_item_lot_id_fkey";
ALTER TABLE public."sale_item" RENAME CONSTRAINT "sale_item_wine_vintage_id_fkey" TO "sale_item_lot_id_fkey";
ALTER TABLE public."tasting_feedback" RENAME CONSTRAINT "tasting_feedback_wine_vintage_id_fkey" TO "tasting_feedback_lot_id_fkey";
ALTER TABLE public."tasting_lot" RENAME CONSTRAINT "tastings_wines_tasting_id_fkey" TO "tasting_lot_tasting_id_fkey";
ALTER TABLE public."tasting_lot" RENAME CONSTRAINT "tastings_wines_wine_vintage_id_fkey" TO "tasting_lot_lot_id_fkey";
ALTER TABLE public."note" RENAME CONSTRAINT "wine_tasting_notes_wine_vintage_id_fkey" TO "note_lot_id_fkey";
ALTER TABLE public."lot" RENAME CONSTRAINT "wine_vintages_wine_id_fkey" TO "lot_product_id_fkey";
ALTER TABLE public."producer" RENAME CONSTRAINT "wineries_country_id_fkey" TO "producer_country_id_fkey";
ALTER TABLE public."producer" RENAME CONSTRAINT "wineries_region_id_fkey" TO "producer_region_id_fkey";
ALTER TABLE public."product" RENAME CONSTRAINT "wines_appelation_id_fkey" TO "product_appellation_id_fkey";
ALTER TABLE public."lot_variety" RENAME CONSTRAINT "wines_grapes_grape_id_fkey" TO "lot_variety_variety_id_fkey";
ALTER TABLE public."lot_variety" RENAME CONSTRAINT "wines_grapes_wine_vintage_id_fkey" TO "lot_variety_lot_id_fkey";
ALTER TABLE public."product_pairing" RENAME CONSTRAINT "wines_pairings_pairing_id_fkey" TO "product_pairing_pairing_id_fkey";
ALTER TABLE public."product_pairing" RENAME CONSTRAINT "wines_pairings_wine_id_fkey" TO "product_pairing_product_id_fkey";
ALTER TABLE public."product" RENAME CONSTRAINT "wines_wine_type_id_fkey" TO "product_product_type_id_fkey";
ALTER TABLE public."product" RENAME CONSTRAINT "wines_winery_id_fkey" TO "product_producer_id_fkey";
ALTER INDEX public."wine_kind_idx" RENAME TO "product_kind_idx";
ALTER INDEX public."wine_vintage_lot_key" RENAME TO "lot_identity_key";
ALTER INDEX public."wine_vintage_lot_without_year_key" RENAME TO "lot_identity_without_year_key";
ALTER TABLE public."lot" RENAME CONSTRAINT "wine_vintage_volume_ml_check" TO "lot_volume_ml_check";
COMMENT ON TABLE public."tasting_feedback" IS 'Notes laissées par les invités ; la dernière ligne par (guest_id, lot_id) fait foi';
COMMENT ON COLUMN public."tasting"."live_position" IS 'Index (0-based) du produit servi en mode live';

-- 4. Triggers
ALTER TRIGGER "appelation_kind_locked" ON public."appellation" RENAME TO "appellation_kind_locked";
ALTER TRIGGER "grape_kind_locked" ON public."variety" RENAME TO "variety_kind_locked";
ALTER TRIGGER "wine_kind_check" ON public."product" RENAME TO "product_kind_check";
ALTER TRIGGER "wine_kind_locked" ON public."product" RENAME TO "product_kind_locked";
ALTER TRIGGER "wine_type_kind_locked" ON public."product_type" RENAME TO "product_type_kind_locked";
ALTER TRIGGER "wine_vintage_grape_kind_check" ON public."lot_variety" RENAME TO "lot_variety_kind_check";
ALTER TRIGGER "wine_vintage_kind_check" ON public."lot" RENAME TO "lot_kind_check";
ALTER TRIGGER "wine_vintage_kind_lock" ON public."lot" RENAME TO "lot_kind_lock";

-- 5. Vue inventory, avant les fonctions qui la lisent
ALTER VIEW public."inventory" RENAME COLUMN "wine_vintage_id" TO "lot_id";

-- 6. Transition : les anciennes clés wine_vintage_id du JSON des lignes sont lues comme lot_id. Un onglet
-- ouvert avant la bascule (vente, commande, pré-commande d'un invité, demande « J'en veux ») envoie encore
-- l'ancienne clé : sans cela, ses lignes seraient perdues ou enregistrées sans lot, sans erreur.
-- Non couvert : la note d'un invité envoyée par un onglet d'avant la bascule (colonne de tasting_feedback
-- renommée) est refusée ; d'où une bascule hors de toute dégustation.
-- À retirer par une migration de nettoyage quelques jours après la bascule.
CREATE FUNCTION public."legacy_lot_items"("p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  SELECT CASE WHEN jsonb_typeof(p_items) = 'array' AND p_items @? '$[*].wine_vintage_id' THEN (
    SELECT jsonb_agg(CASE WHEN jsonb_typeof(e) = 'object' AND e ? 'wine_vintage_id'
      THEN (e - 'wine_vintage_id') || jsonb_build_object('lot_id', e -> 'wine_vintage_id') ELSE e END ORDER BY i)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS x(e, i)
  ) ELSE p_items END
$$;
ALTER FUNCTION public."legacy_lot_items"("p_items" "jsonb") OWNER TO "postgres";

CREATE FUNCTION public."legacy_lot_items_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.items := public.legacy_lot_items(NEW.items);
  RETURN NEW;
END;
$$;
ALTER FUNCTION public."legacy_lot_items_row"() OWNER TO "postgres";
CREATE TRIGGER "wish_request_legacy_lot_items" BEFORE INSERT OR UPDATE OF "items" ON public."wish_request"
  FOR EACH ROW EXECUTE FUNCTION public."legacy_lot_items_row"();

-- 7. Fonctions de trigger : renommées (même OID, triggers et droits conservés), puis corps réécrit
ALTER FUNCTION public."check_wine_kind"() RENAME TO "check_product_kind";
ALTER FUNCTION public."check_vintage_kind"() RENAME TO "check_lot_kind";
ALTER FUNCTION public."check_vintage_grape_kind"() RENAME TO "check_lot_variety_kind";
CREATE OR REPLACE FUNCTION "public"."check_lot_variety_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1
  FROM lot v
  JOIN product w ON w.id = v.product_id
  JOIN variety g ON g.id = NEW.variety_id
  WHERE v.id = NEW.lot_id AND g.kind = w.kind
  FOR SHARE OF v, w, g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce cépage ou cette variété ne correspond pas au produit (vin ou huile)';
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."check_lot_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM product WHERE id = NEW.product_id FOR SHARE;
  PERFORM 1 FROM variety g JOIN lot_variety vg ON vg.variety_id = g.id WHERE vg.lot_id = NEW.id
  FOR SHARE OF g;
  IF EXISTS (
    SELECT 1
    FROM lot_variety vg
    JOIN variety g ON g.id = vg.variety_id
    WHERE vg.lot_id = NEW.id AND g.kind <> (SELECT kind FROM product WHERE id = NEW.product_id)
  ) THEN
    RAISE EXCEPTION 'Les cépages ou variétés de ce lot ne correspondent pas au produit (vin ou huile)';
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."check_product_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM product_type WHERE id = NEW.product_type_id AND kind = NEW.kind FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ce type (robe, fruité…) ne correspond pas au produit';
  END IF;
  IF NEW.appellation_id IS NOT NULL THEN
    PERFORM 1 FROM appellation WHERE id = NEW.appellation_id AND kind = NEW.kind FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette appellation ne correspond pas au produit (vin ou huile)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."prevent_kind_change_in_use"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (TG_TABLE_NAME = 'product' AND EXISTS (SELECT 1 FROM lot WHERE product_id = NEW.id))
     OR (TG_TABLE_NAME = 'product_type' AND EXISTS (SELECT 1 FROM product WHERE product_type_id = NEW.id))
     OR (TG_TABLE_NAME = 'appellation' AND EXISTS (SELECT 1 FROM product WHERE appellation_id = NEW.id))
     OR (TG_TABLE_NAME = 'variety' AND EXISTS (SELECT 1 FROM lot_variety WHERE variety_id = NEW.id)) THEN
    RAISE EXCEPTION 'Déjà utilisé : son type de produit ne peut plus changer';
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."set_sale_item_vat_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.vat_rate := coalesce(
    (SELECT product_kind_vat_rate(w.kind) FROM lot v JOIN product w ON w.id = v.product_id WHERE v.id = NEW.lot_id),
    product_kind_vat_rate('wine')
  );
  RETURN NEW;
END;
$$;



-- 8. Autres fonctions. Même signature : corps remplacé (droits conservés). Signature changée
-- (nom, paramètres, colonnes de retour) : supprimées puis recréées avec leurs droits d'origine.
CREATE OR REPLACE FUNCTION "public"."my_notebook"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'email', v_email,
    'customers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name)), '[]'::jsonb)
      FROM customer c WHERE lower(c.email) = v_email
    ),
    'sales', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'date', s.date,
        'status', s.status,
        'total_price', s.total_price,
        'items', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'lot_id', si.lot_id,
            'quantity', si.quantity,
            'price', si.price,
            'note', si.note
          )), '[]'::jsonb)
          FROM sale_item si WHERE si.sale_id = s.id
        )
      ) ORDER BY s.date DESC), '[]'::jsonb)
      FROM sale s
      JOIN customer c ON c.id = s.customer_id
      WHERE lower(c.email) = v_email AND s.status <> 'cancelled'
    ),
    'tastings', (
      SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'date', t.date)), '[]'::jsonb)
      FROM tasting t
      WHERE t.id IN (
        SELECT tc.tasting_id FROM tasting_customer tc JOIN customer c ON c.id = tc.customer_id WHERE lower(c.email) = v_email
        UNION
        SELECT r.tasting_id FROM tasting_registration r WHERE lower(r.email) = v_email AND r.status <> 'cancelled'
      )
    ),
    'feedback', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'tasting_id', f.tasting_id,
        'lot_id', f.lot_id,
        'rating', f.rating,
        'comment', f.comment,
        'created_at', f.created_at
      ) ORDER BY f.created_at), '[]'::jsonb)
      FROM tasting_feedback f WHERE lower(f.guest_email) = v_email
    )
  );
END;
$$;


CREATE OR REPLACE FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_confirm" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_raw jsonb := coalesce(public.legacy_lot_items(p_items), '[]'::jsonb);  -- transition, voir section 6
  v_confirm boolean := coalesce(p_confirm, false);
  v_items jsonb;
  v_draft live_preorder;
  v_id uuid;
BEGIN
  IF p_tasting_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Dégustation ou invité manquant.';
  END IF;
  IF jsonb_typeof(v_raw) <> 'array' THEN
    RAISE EXCEPTION 'Pré-commande illisible.';
  END IF;
  -- Comme les notes, une pré-commande ne s'enregistre qu'autour de la soirée : pas de lignes laissées
  -- dans Piloter par n'importe qui à n'importe quelle date. La confirmation, elle, reste possible après.
  IF NOT v_confirm AND NOT EXISTS (
    SELECT 1 FROM tasting t WHERE t.id = p_tasting_id AND t.date BETWEEN current_date - 1 AND current_date + 1
  ) THEN
    RETURN NULL;
  END IF;

  -- Une ligne par vin de la dégustation, quantités entières de 1 à 60 ; le reste est ignoré.
  SELECT coalesce(jsonb_agg(jsonb_build_object('lot_id', l.vid, 'quantity', l.qty) ORDER BY l.vid), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT (e ->> 'lot_id')::uuid AS vid, least(sum((e ->> 'quantity')::int), 60) AS qty
    FROM jsonb_array_elements(v_raw) e
    WHERE (e ->> 'lot_id') ~* '^[0-9a-f-]{36}$'
      AND (e ->> 'quantity') ~ '^[0-9]{1,3}$'
      AND (e ->> 'quantity')::int > 0
    GROUP BY 1
  ) l
  WHERE EXISTS (
    SELECT 1 FROM tasting_lot twv WHERE twv.tasting_id = p_tasting_id AND twv.lot_id = l.vid
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
  INSERT INTO wish_request (tasting_id, source, guest_id, first_name, last_name, email, phone, items)
  VALUES (p_tasting_id, 'live', p_guest_id, v_draft.first_name, v_draft.last_name, v_draft.email, v_draft.phone, v_draft.items)
  RETURNING id INTO v_id;
  DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;

  RETURN v_id;
END;
$_$;


CREATE OR REPLACE FUNCTION "public"."save_order"("p_order_id" "uuid", "p_order" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order "order" := jsonb_populate_record(NULL::"order", p_order);
  v_id uuid;
  v_status text;
  v_transport_status text;
BEGIN
  p_items := public.legacy_lot_items(p_items);  -- transition, voir section 6
  PERFORM assert_admin();

  IF p_order_id IS NULL THEN
    INSERT INTO "order" (date, supplier_id, status, note, total_price)
    VALUES (v_order.date, v_order.supplier_id, coalesce(v_order.status, 'pending'), v_order.note, 0)
    RETURNING id INTO v_id;
  ELSE
    SELECT o.status, t.status INTO v_status, v_transport_status
    FROM "order" o LEFT JOIN transport t ON t.id = o.transport_id
    WHERE o.id = p_order_id
    FOR UPDATE OF o;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Commande introuvable';
    END IF;
    IF v_status = 'confirmed' THEN
      RAISE EXCEPTION 'Impossible de modifier une commande confirmée';
    END IF;
    IF v_transport_status IN ('delivered', 'cancelled') THEN
      RAISE EXCEPTION 'Impossible de modifier une commande dont le transport est livré ou annulé';
    END IF;
    UPDATE "order" SET
      date = v_order.date,
      supplier_id = v_order.supplier_id,
      status = coalesce(v_order.status, status),
      note = v_order.note
    WHERE id = p_order_id;
    DELETE FROM order_item WHERE order_id = p_order_id;
    v_id := p_order_id;
  END IF;

  INSERT INTO order_item (order_id, lot_id, quantity, price, note)
  SELECT v_id, i.lot_id, i.quantity, i.price, i.note
  FROM jsonb_populate_recordset(NULL::order_item, p_items) AS i;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."save_sale"("p_sale_id" "uuid", "p_sale" "jsonb", "p_items" "jsonb", "p_wish_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sale sale := jsonb_populate_record(NULL::sale, p_sale);
  v_id uuid;
  v_status text;
BEGIN
  p_items := public.legacy_lot_items(p_items);  -- transition, voir section 6
  PERFORM assert_admin();

  IF p_sale_id IS NULL THEN
    INSERT INTO sale (date, customer_id, status, total_price, note, global_discount, global_discount_type, payment_method, tasting_id)
    VALUES (v_sale.date, v_sale.customer_id, 'pending', v_sale.total_price, v_sale.note, v_sale.global_discount,
            v_sale.global_discount_type, v_sale.payment_method, v_sale.tasting_id)
    RETURNING id INTO v_id;
  ELSE
    SELECT status INTO v_status FROM sale WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vente introuvable';
    END IF;
    IF v_status <> 'pending' THEN
      RAISE EXCEPTION 'Seule une vente en attente se modifie : son stock n’est pas encore sorti.';
    END IF;
    UPDATE sale SET
      date = v_sale.date,
      customer_id = v_sale.customer_id,
      total_price = v_sale.total_price,
      note = v_sale.note,
      global_discount = v_sale.global_discount,
      global_discount_type = v_sale.global_discount_type,
      payment_method = v_sale.payment_method,
      tasting_id = v_sale.tasting_id
    WHERE id = p_sale_id;
    DELETE FROM sale_item WHERE sale_id = p_sale_id;
    v_id := p_sale_id;
  END IF;

  INSERT INTO sale_item (sale_id, lot_id, quantity, price, discount, discount_type, note)
  SELECT v_id, i.lot_id, i.quantity, i.price, i.discount, i.discount_type, i.note
  FROM jsonb_populate_recordset(NULL::sale_item, p_items) AS i;

  IF p_wish_id IS NOT NULL THEN
    UPDATE wish_request SET status = 'done', sale_id = v_id WHERE id = p_wish_id AND status = 'new';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette demande a déjà été traitée.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."set_sale_status"("p_sale_id" "uuid", "p_status" "text", "p_payment_method" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_old text;
  v_payment text;
  v_number text;
  v_customer text;
BEGIN
  PERFORM assert_admin();

  SELECT s.status, s.payment_method, s.invoice_number,
         nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '')
  INTO v_old, v_payment, v_number, v_customer
  FROM sale s
  LEFT JOIN customer c ON c.id = s.customer_id
  WHERE s.id = p_sale_id
  FOR UPDATE OF s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;
  IF v_old = p_status THEN
    RETURN v_number;
  END IF;

  IF NOT (
    (v_old = 'pending' AND p_status IN ('paid', 'delivered'))
    OR (v_old = 'paid' AND p_status IN ('delivered', 'closed'))
    OR (v_old = 'delivered' AND p_status IN ('paid', 'closed'))
  ) THEN
    RAISE EXCEPTION 'Changement de statut impossible : %', v_old || ' → ' || p_status;
  END IF;
  -- La facture (« Payée » ou « Clôturée ») exige un mode de paiement, fourni ici s'il manque :
  -- une vente livrée n'est plus modifiable.
  IF p_status IN ('paid', 'closed') THEN
    v_payment := coalesce(nullif(trim(p_payment_method), ''), v_payment);
    IF coalesce(trim(v_payment), '') = '' THEN
      RAISE EXCEPTION 'Indiquez le mode de paiement avant de facturer la vente (payée ou clôturée).';
    END IF;
  END IF;

  UPDATE sale SET status = p_status, payment_method = v_payment WHERE id = p_sale_id;

  IF v_old = 'pending' THEN
    INSERT INTO stock_move (lot_id, reason, quantity, date, note)
    SELECT lot_id, 'sale_out', -abs(quantity), brussels_today(), 'Vente à ' || coalesce(v_customer, 'Client inconnu')
    FROM sale_item
    WHERE sale_id = p_sale_id AND lot_id IS NOT NULL;
  END IF;

  IF p_status IN ('paid', 'closed') THEN
    v_number := assign_invoice_number(p_sale_id);
  END IF;
  RETURN v_number;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."set_transport_status"("p_transport_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_old text;
BEGIN
  PERFORM assert_admin();

  SELECT status INTO v_old FROM transport WHERE id = p_transport_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport introuvable';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_status THEN
    RETURN;
  END IF;
  IF v_old = 'delivered' THEN
    RAISE EXCEPTION 'Un transport livré ne change plus de statut : son stock est déjà entré.';
  END IF;

  UPDATE transport SET status = p_status WHERE id = p_transport_id;

  IF p_status = 'delivered' THEN
    INSERT INTO stock_move (lot_id, reason, quantity, date, note)
    SELECT oi.lot_id, 'purchase_in', abs(oi.quantity), brussels_today(), 'Réception transport'
    FROM order_item oi
    JOIN "order" o ON o.id = oi.order_id
    WHERE o.transport_id = p_transport_id;
  END IF;
END;
$$;


DROP FUNCTION public."add_to_supplier_order"("p_supplier_id" "uuid", "p_vintage_id" "uuid", "p_quantity" integer, "p_price" numeric);
CREATE OR REPLACE FUNCTION "public"."add_to_supplier_order"("p_supplier_id" "uuid", "p_lot_id" "uuid", "p_quantity" integer, "p_price" numeric) RETURNS TABLE("order_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_order uuid;
  v_created boolean := false;
BEGIN
  PERFORM assert_admin();
  PERFORM pg_advisory_xact_lock(hashtext('order.reorder'), hashtext(p_supplier_id::text));

  SELECT o.id INTO v_order
  FROM "order" o
  WHERE o.supplier_id = p_supplier_id AND o.status = 'pending' AND o.transport_id IS NULL
  ORDER BY o.date DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order IS NULL THEN
    INSERT INTO "order" (date, supplier_id, status, note, total_price)
    VALUES (brussels_today(), p_supplier_id, 'pending', 'Réassort préparé depuis le tableau de bord', 0)
    RETURNING id INTO v_order;
    v_created := true;
  END IF;

  UPDATE order_item SET quantity = quantity + p_quantity
  WHERE id = (
    SELECT oi.id FROM order_item oi
    WHERE oi.order_id = v_order AND oi.lot_id = p_lot_id
    ORDER BY oi.created_at
    LIMIT 1
  );
  IF NOT FOUND THEN
    INSERT INTO order_item (order_id, lot_id, quantity, price)
    VALUES (v_order, p_lot_id, p_quantity, p_price);
  END IF;

  RETURN QUERY SELECT v_order, v_created;
END;
$$;

ALTER FUNCTION public."add_to_supplier_order"("p_supplier_id" "uuid", "p_lot_id" "uuid", "p_quantity" integer, "p_price" numeric) OWNER TO "postgres";
GRANT ALL ON FUNCTION public."add_to_supplier_order"("p_supplier_id" "uuid", "p_lot_id" "uuid", "p_quantity" integer, "p_price" numeric) TO "anon";
GRANT ALL ON FUNCTION public."add_to_supplier_order"("p_supplier_id" "uuid", "p_lot_id" "uuid", "p_quantity" integer, "p_price" numeric) TO "authenticated";
GRANT ALL ON FUNCTION public."add_to_supplier_order"("p_supplier_id" "uuid", "p_lot_id" "uuid", "p_quantity" integer, "p_price" numeric) TO "service_role";

DROP FUNCTION public."create_wine_vintage"("p_vintage" "jsonb", "p_source_id" "uuid", "p_copy_grapes" boolean, "p_copy_notes" boolean);
CREATE OR REPLACE FUNCTION "public"."create_lot"("p_lot" "jsonb", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_copy_varieties" boolean DEFAULT false, "p_copy_notes" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v lot := jsonb_populate_record(NULL::lot, p_lot);
  v_id uuid;
BEGIN
  PERFORM assert_admin();

  IF p_source_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM lot WHERE id = p_source_id AND product_id = v.product_id) THEN
    RAISE EXCEPTION 'Le lot repris doit appartenir au même produit';
  END IF;

  INSERT INTO lot (product_id, production_year, year, abv, price, image_url, organic, volume_ml)
  VALUES (v.product_id, v.production_year, v.year, v.abv, v.price, v.image_url, coalesce(v.organic, false),
          coalesce(v.volume_ml, 750))
  RETURNING id INTO v_id;
  -- Prix d'achat obligatoire : non renseigné, on garde le défaut de la colonne.
  IF v.purchase_price IS NOT NULL THEN
    UPDATE lot SET purchase_price = v.purchase_price WHERE id = v_id;
  END IF;

  IF p_source_id IS NOT NULL AND p_copy_varieties THEN
    INSERT INTO lot_variety (lot_id, variety_id, percentage)
    SELECT v_id, variety_id, percentage FROM lot_variety WHERE lot_id = p_source_id;
  END IF;

  IF p_source_id IS NOT NULL AND p_copy_notes THEN
    INSERT INTO note (lot_id, type, content)
    SELECT v_id, type, content FROM note WHERE lot_id = p_source_id;
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public."create_lot"("p_lot" "jsonb", "p_source_id" "uuid", "p_copy_varieties" boolean, "p_copy_notes" boolean) OWNER TO "postgres";
GRANT ALL ON FUNCTION public."create_lot"("p_lot" "jsonb", "p_source_id" "uuid", "p_copy_varieties" boolean, "p_copy_notes" boolean) TO "anon";
GRANT ALL ON FUNCTION public."create_lot"("p_lot" "jsonb", "p_source_id" "uuid", "p_copy_varieties" boolean, "p_copy_notes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION public."create_lot"("p_lot" "jsonb", "p_source_id" "uuid", "p_copy_varieties" boolean, "p_copy_notes" boolean) TO "service_role";

DROP FUNCTION public."public_wine_availability"();
CREATE OR REPLACE FUNCTION "public"."public_lot_availability"() RETURNS TABLE("lot_id" "uuid", "in_stock" boolean, "low_stock" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    i.lot_id,
    coalesce(i.quantity_on_hand, 0) > 0,
    coalesce(i.quantity_on_hand, 0) BETWEEN 1 AND 6
  FROM inventory i
  WHERE i.lot_id IS NOT NULL;
$$;

ALTER FUNCTION public."public_lot_availability"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public."public_lot_availability"() FROM PUBLIC;
GRANT ALL ON FUNCTION public."public_lot_availability"() TO "anon";
GRANT ALL ON FUNCTION public."public_lot_availability"() TO "authenticated";
GRANT ALL ON FUNCTION public."public_lot_availability"() TO "service_role";

DROP FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_wine_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]);
CREATE OR REPLACE FUNCTION "public"."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v tasting := jsonb_populate_record(NULL::tasting, p_tasting);
  v_id uuid;
BEGIN
  PERFORM assert_admin();

  IF p_tasting_id IS NULL THEN
    INSERT INTO tasting (name, date, location, notes, start_time, price, capacity, description, is_private)
    VALUES (v.name, v.date, v.location, v.notes, v.start_time, v.price, v.capacity, v.description, coalesce(v.is_private, false))
    RETURNING id INTO v_id;
  ELSE
    UPDATE tasting SET
      name = v.name, date = v.date, location = v.location, notes = v.notes, start_time = v.start_time,
      price = v.price, capacity = v.capacity, description = v.description, is_private = coalesce(v.is_private, false)
    WHERE id = p_tasting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dégustation introuvable';
    END IF;
    v_id := p_tasting_id;
  END IF;

  DELETE FROM tasting_lot WHERE tasting_id = v_id;
  INSERT INTO tasting_lot (tasting_id, lot_id, "order")
  SELECT v_id, w.id, w.ord FROM unnest(p_lot_ids) WITH ORDINALITY AS w(id, ord);

  DELETE FROM tasting_customer WHERE tasting_id = v_id AND customer_id = ANY (p_removed_customer_ids);
  INSERT INTO tasting_customer (tasting_id, customer_id)
  SELECT DISTINCT v_id, c FROM unnest(p_added_customer_ids) AS c
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]) OWNER TO "postgres";
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]) TO "service_role";

-- 9. Lignes des demandes et pré-commandes déjà enregistrées : la clé du lot suit le renommage
UPDATE public."wish_request" SET items = public.legacy_lot_items(items) WHERE items @? '$[*].wine_vintage_id';
UPDATE public."live_preorder" SET items = public.legacy_lot_items(items) WHERE items @? '$[*].wine_vintage_id';

NOTIFY pgrst, 'reload schema';
