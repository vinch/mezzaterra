-- Réservations en ligne et messages du site : tout arrive dans la gestion, sans rapprochement à la main.
--
-- 1. Une réservation confirmée rattache aussitôt l'inscrit à la dégustation : client retrouvé (même
--    email, sinon même téléphone) ou créé, puis ajouté aux participants. La liste des participants
--    devient la seule liste de « qui vient ».
--    Retirer un participant annule sa réservation.
-- 2. Les places comptent tout le monde : chaque participant occupe une place, ou les places de sa
--    réservation en ligne s'il en a une ; une réservation confirmée pas encore rattachée compte aussi.
--    Le site ne propose donc plus des places déjà données à des participants ajoutés à la main.
-- 3. Les messages du formulaire de contact sont enregistrés (contact_message, par le serveur avec la
--    clé service_role) et apparaissent dans Demandes ; l'email part toujours en plus quand Resend est
--    configuré.

-- ——— Places prises ———
CREATE OR REPLACE FUNCTION public.tasting_seats_taken(p_tasting_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    coalesce((
      SELECT sum(coalesce(r.seats, 1))
      FROM tasting_customer tc
      LEFT JOIN LATERAL (
        SELECT sum(reg.seats) AS seats
        FROM tasting_registration reg
        WHERE reg.tasting_id = tc.tasting_id AND reg.customer_id = tc.customer_id AND reg.status = 'confirmed'
      ) r ON true
      WHERE tc.tasting_id = p_tasting_id
    ), 0)
    + coalesce((
      SELECT sum(reg.seats)
      FROM tasting_registration reg
      WHERE reg.tasting_id = p_tasting_id AND reg.status = 'confirmed' AND reg.customer_id IS NULL
    ), 0)
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.tasting_availability(p_tasting_id uuid)
RETURNS TABLE (capacity integer, seats_taken integer, seats_left integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.capacity,
    s.taken,
    CASE WHEN t.capacity IS NULL THEN NULL ELSE greatest(t.capacity - s.taken, 0) END
  FROM tasting t
  CROSS JOIN LATERAL (SELECT tasting_seats_taken(t.id) AS taken) s
  WHERE t.id = p_tasting_id;
$$;

-- ——— Client retrouvé ou créé : réservations en ligne et, via admin_find_or_create_customer, « J'en veux » ———
-- p_match_phone : sans admin pour vérifier (réservation en ligne), seul l'email désigne un client
-- existant ; un téléphone partagé ou mal saisi rattacherait la réservation à quelqu'un d'autre.
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_match_phone boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
BEGIN
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM customer WHERE lower(email) = v_email ORDER BY created_at LIMIT 1;
  END IF;
  IF v_id IS NULL AND v_phone IS NOT NULL AND p_match_phone THEN
    SELECT id INTO v_id FROM customer WHERE phone_number = v_phone ORDER BY created_at LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO customer (first_name, last_name, email, phone_number)
    VALUES (coalesce(nullif(trim(p_first_name), ''), '—'), coalesce(trim(p_last_name), ''), v_email, v_phone)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- Gestion : même règle pour les « J'en veux » transformés en vente (findOrCreateCustomer).
CREATE OR REPLACE FUNCTION public.admin_find_or_create_customer(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_admin();
  RETURN find_or_create_customer(p_first_name, p_last_name, p_email, p_phone);
END;
$$;

-- ——— Réservation → client + participant ———
CREATE OR REPLACE FUNCTION public.link_registration_to_customer(p_registration_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r tasting_registration;
  v_customer uuid;
BEGIN
  SELECT * INTO r FROM tasting_registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;
  v_customer := coalesce(r.customer_id, find_or_create_customer(r.first_name, r.last_name, r.email, r.phone, false));
  INSERT INTO tasting_customer (tasting_id, customer_id) VALUES (r.tasting_id, v_customer) ON CONFLICT DO NOTHING;
  UPDATE tasting_registration SET customer_id = v_customer WHERE id = r.id;
  RETURN v_customer;
END;
$$;

-- Retirer un participant annule sa réservation en ligne : ses places se libèrent, il ne reçoit plus
-- les rappels des inscrits et peut réserver de nouveau.
CREATE OR REPLACE FUNCTION public.cancel_registration_of_removed_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE tasting_registration
  SET status = 'cancelled'
  WHERE tasting_id = OLD.tasting_id AND customer_id = OLD.customer_id AND status <> 'cancelled';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tasting_customer_cancel_registration ON public.tasting_customer;
CREATE TRIGGER tasting_customer_cancel_registration
  AFTER DELETE ON public.tasting_customer
  FOR EACH ROW EXECUTE FUNCTION public.cancel_registration_of_removed_participant();

-- Gestion : confirmer une réservation (liste d'attente, ou rattachement qui aurait échoué).
CREATE OR REPLACE FUNCTION public.confirm_tasting_registration(p_registration_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_admin();
  UPDATE tasting_registration SET status = 'confirmed' WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;
  RETURN link_registration_to_customer(p_registration_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_for_tasting(
  p_tasting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_seats integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_date date;
  v_private boolean;
  v_status text;
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF coalesce(trim(p_first_name), '') = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF coalesce(p_seats, 0) < 1 OR p_seats > 10 THEN
    RAISE EXCEPTION 'invalid_seats';
  END IF;

  SELECT capacity, date, is_private INTO v_capacity, v_date, v_private FROM tasting WHERE id = p_tasting_id FOR UPDATE;
  -- Une dégustation privée n'accepte pas d'inscription publique.
  IF NOT FOUND OR v_private THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_date < current_date THEN
    RAISE EXCEPTION 'past';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasting_registration
    WHERE tasting_id = p_tasting_id AND lower(email) = v_email AND status <> 'cancelled'
  ) THEN
    RETURN 'already_registered';
  END IF;

  v_status := CASE
    WHEN v_capacity IS NULL OR tasting_seats_taken(p_tasting_id) + p_seats <= v_capacity THEN 'confirmed'
    ELSE 'waitlist'
  END;

  INSERT INTO tasting_registration (tasting_id, first_name, last_name, email, phone, seats, status)
  VALUES (
    p_tasting_id,
    trim(p_first_name),
    nullif(trim(coalesce(p_last_name, '')), ''),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    p_seats,
    v_status
  )
  RETURNING id INTO v_id;

  -- Best effort : la réservation compte même si le rattachement échoue (la gestion propose alors
  -- « Ajouter aux participants »).
  IF v_status = 'confirmed' THEN
    BEGIN
      PERFORM link_registration_to_customer(v_id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- Best effort : une contrainte inattendue sur email_subscriber ne doit pas bloquer l'inscription.
  BEGIN
    INSERT INTO email_subscriber (email, source) VALUES (v_email, 'registration') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN v_status;
END;
$$;

-- Réservations confirmées des dégustations à venir, pas encore rattachées.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT reg.id
    FROM tasting_registration reg
    JOIN tasting t ON t.id = reg.tasting_id
    WHERE reg.status = 'confirmed' AND reg.customer_id IS NULL AND t.date >= current_date
    ORDER BY reg.created_at
  LOOP
    PERFORM link_registration_to_customer(r.id);
  END LOOP;
END $$;

-- ——— Messages du formulaire de contact ———
CREATE TABLE IF NOT EXISTS public.contact_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL CHECK (char_length(reason) <= 40),
  subject text CHECK (char_length(subject) <= 200),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text CHECK (char_length(last_name) <= 80),
  email text NOT NULL CHECK (char_length(email) <= 200),
  phone text CHECK (char_length(phone) <= 40),
  page text CHECK (char_length(page) <= 300),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Écrite seulement par le serveur (/api/contact, clé service_role) après Turnstile : aucune écriture publique.
COMMENT ON TABLE public.contact_message IS 'Messages du formulaire de contact du site (écrits par /api/contact)';

ALTER TABLE public.contact_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read" ON public.contact_message FOR SELECT USING (is_admin());
CREATE POLICY "admins can update" ON public.contact_message FOR UPDATE USING (is_admin());
CREATE POLICY "admins can delete" ON public.contact_message FOR DELETE USING (is_admin());

-- ——— Droits ———
-- Les fonctions internes ne sont appelées que par les fonctions SECURITY DEFINER ci-dessus (Supabase
-- accorde par défaut l'exécution à anon et authenticated : on la retire explicitement).
REVOKE ALL ON FUNCTION public.tasting_seats_taken(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_or_create_customer(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_registration_to_customer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_registration_of_removed_participant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_tasting_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tasting_registration(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_find_or_create_customer(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_or_create_customer(text, text, text, text) TO authenticated;
