-- Fusion de deux fiches client.
--
-- Un client déjà connu qui réserve sur le site avec un autre email (ou alors que sa fiche n'en a pas)
-- n'est pas reconnu : la réservation crée une seconde fiche. Un admin les fusionne depuis la fiche
-- client : ventes, réservations, participations et notes de dégustation passent sur la fiche gardée,
-- qui complète ses coordonnées manquantes avec celles de l'autre, puis l'autre est supprimée.
-- Les réservations gardent leurs places (le +1 d'une réservation à deux reste compté).
-- Deux emails différents : l'admin choisit celui qui reste (p_keep_from_email), celui avec lequel le
-- client réserve désormais, sinon la prochaine réservation recréerait un doublon. Le carnet client du
-- site se retrouve par l'email de connexion : il suit l'email gardé.
-- Les factures se lisent sur la fiche : une vente déjà facturée de la fiche supprimée porte ensuite
-- les coordonnées de la fiche gardée (même personne).
-- Une nouvelle table qui référence customer doit être ajoutée ici : sinon ses lignes suivent le
-- ON DELETE de la fiche supprimée.

CREATE OR REPLACE FUNCTION public.merge_customers(p_from uuid, p_into uuid, p_keep_from_email boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f customer;
  v_into_email text;
  v_email text;
BEGIN
  PERFORM assert_admin();
  IF p_from = p_into THEN
    RAISE EXCEPTION 'Choisissez deux fiches différentes';
  END IF;
  -- Ordre fixe : deux fusions croisées simultanées ne s'interbloquent pas.
  PERFORM 1 FROM customer WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
  SELECT * INTO f FROM customer WHERE id = p_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;
  SELECT email INTO v_into_email FROM customer WHERE id = p_into;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  UPDATE sale SET customer_id = p_into WHERE customer_id = p_from;
  UPDATE member SET customer_id = p_into WHERE customer_id = p_from;
  -- Réservations d'abord : retirer ensuite la participation de p_from n'en annule aucune
  -- (trigger tasting_customer_cancel_registration).
  UPDATE tasting_registration SET customer_id = p_into WHERE customer_id = p_from;
  -- Même dégustation des deux côtés : une seule participation, avec le plus de places sans réservation
  -- (ajouté à la main, 1, l'emporte sur un « J'en veux », 0).
  INSERT INTO tasting_customer (tasting_id, customer_id, seats)
  SELECT tasting_id, p_into, seats FROM tasting_customer WHERE customer_id = p_from
  ON CONFLICT (tasting_id, customer_id) DO UPDATE SET seats = greatest(tasting_customer.seats, excluded.seats);
  DELETE FROM tasting_customer WHERE customer_id = p_from;

  -- Supprimée avant de compléter l'autre : un email unique ne bloque pas la recopie.
  DELETE FROM customer WHERE id = p_from;

  UPDATE customer SET
    email = CASE
      WHEN p_keep_from_email AND nullif(trim(f.email), '') IS NOT NULL THEN f.email
      ELSE coalesce(nullif(trim(email), ''), f.email)
    END,
    phone_number = coalesce(nullif(trim(phone_number), ''), f.phone_number)
  WHERE id = p_into
  RETURNING email INTO v_email;
  -- Société et TVA, puis adresse : chacune d'un bloc, et seulement si la fiche gardée n'en a pas et
  -- l'autre si, pour ne mêler ni la TVA d'une société à une autre, ni la rue de l'une et la ville de
  -- l'autre, ni effacer un code postal isolé.
  UPDATE customer SET company_name = f.company_name, vat = f.vat
  WHERE id = p_into
    AND coalesce(nullif(trim(company_name), ''), nullif(trim(vat), '')) IS NULL
    AND coalesce(nullif(trim(f.company_name), ''), nullif(trim(f.vat), '')) IS NOT NULL;
  UPDATE customer SET
    address_line_1 = f.address_line_1,
    address_line_2 = f.address_line_2,
    zip_code = f.zip_code,
    city = f.city,
    country_id = f.country_id
  WHERE id = p_into
    AND coalesce(nullif(trim(address_line_1), ''), nullif(trim(city), '')) IS NULL
    AND coalesce(nullif(trim(f.address_line_1), ''), nullif(trim(f.city), '')) IS NOT NULL;

  -- Notes de dégustation : rattachées à un email, celles de l'email abandonné suivent l'email gardé.
  IF nullif(trim(v_email), '') IS NOT NULL THEN
    UPDATE tasting_feedback SET guest_email = v_email
    WHERE lower(guest_email) IN (lower(trim(f.email)), lower(trim(v_into_email)))
      AND lower(guest_email) <> lower(v_email);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, boolean) TO authenticated;
