-- Places par participant et rattachement plus fin des réservations en ligne.
--
-- 1. tasting_customer.seats : places occupées par le participant. 1 quand il est ajouté à la main,
--    les places de sa réservation quand il vient du site, 0 quand il n'est rattaché que par un
--    « J'en veux » pendant la soirée (il occupe déjà la place de celui qui l'a amené).
--    Les places prises deviennent la somme de cette colonne.
-- 2. Une réservation retrouve aussi un participant ajouté à la main sans email, s'il est seul de ce
--    nom dans la dégustation : pas de second client, et son email et son téléphone sont complétés.
-- 3. Le contrôle de capacité remplace les places d'un participant déjà inscrit à la main par celles
--    de sa réservation, au lieu de les ajouter.

ALTER TABLE public.tasting_customer
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 0 AND 10);

COMMENT ON COLUMN public.tasting_customer.seats IS
  'Places occupées : 1 ajouté à la main, celles de la réservation en ligne, 0 rattaché par un « J''en veux »';

-- Participants déjà rattachés à une réservation confirmée : places de la réservation.
UPDATE public.tasting_customer tc
SET seats = r.seats
FROM (
  SELECT tasting_id, customer_id, least(sum(seats), 10)::integer AS seats
  FROM public.tasting_registration
  WHERE status = 'confirmed' AND customer_id IS NOT NULL
  GROUP BY tasting_id, customer_id
) r
WHERE tc.tasting_id = r.tasting_id AND tc.customer_id = r.customer_id;

-- ——— Places prises ———
CREATE OR REPLACE FUNCTION public.tasting_seats_taken(p_tasting_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    coalesce((SELECT sum(seats) FROM tasting_customer WHERE tasting_id = p_tasting_id), 0)
    + coalesce((
      SELECT sum(seats) FROM tasting_registration
      WHERE tasting_id = p_tasting_id AND status = 'confirmed' AND customer_id IS NULL
    ), 0)
  )::integer;
$$;

-- ——— Client d'une réservation, sans en créer ———
-- Même email (le client le plus ancien, comme find_or_create_customer), sinon le seul participant de
-- la dégustation sans email qui porte ce prénom et ce nom.
CREATE OR REPLACE FUNCTION public.registration_customer_match(
  p_tasting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_ids uuid[];
BEGIN
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM customer WHERE lower(email) = v_email ORDER BY created_at LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  SELECT array_agg(c.id) INTO v_ids
  FROM tasting_customer tc
  JOIN customer c ON c.id = tc.customer_id
  WHERE tc.tasting_id = p_tasting_id
    AND nullif(trim(coalesce(c.email, '')), '') IS NULL
    AND lower(trim(c.first_name)) = lower(trim(coalesce(p_first_name, '')))
    AND lower(trim(coalesce(c.last_name, ''))) = lower(trim(coalesce(p_last_name, '')));
  RETURN CASE WHEN cardinality(v_ids) = 1 THEN v_ids[1] END;
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
  v_seats integer;
BEGIN
  SELECT * INTO r FROM tasting_registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  v_customer := coalesce(
    r.customer_id,
    registration_customer_match(r.tasting_id, r.first_name, r.last_name, r.email),
    find_or_create_customer(r.first_name, r.last_name, r.email, r.phone, false)
  );
  -- Participant retrouvé par son nom : on complète ses coordonnées sans rien écraser.
  UPDATE customer
  SET email = coalesce(nullif(trim(coalesce(email, '')), ''), lower(trim(r.email))),
      phone_number = coalesce(nullif(trim(coalesce(phone_number, '')), ''), r.phone)
  WHERE id = v_customer;

  UPDATE tasting_registration SET customer_id = v_customer WHERE id = r.id;

  -- Ses places sont celles de ses réservations confirmées (et remplacent la place d'un ajout à la main).
  SELECT least(coalesce(sum(seats), 0), 10)::integer INTO v_seats
  FROM tasting_registration
  WHERE tasting_id = r.tasting_id AND customer_id = v_customer AND status = 'confirmed';
  INSERT INTO tasting_customer (tasting_id, customer_id, seats)
  VALUES (r.tasting_id, v_customer, greatest(v_seats, 1))
  ON CONFLICT (tasting_id, customer_id) DO UPDATE SET seats = EXCLUDED.seats;

  RETURN v_customer;
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
  v_already integer;
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
  -- Date du jour à Bruxelles : entre minuit et 1–2 h, current_date (UTC) est encore la veille.
  IF v_date < brussels_today() THEN
    RAISE EXCEPTION 'past';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasting_registration
    WHERE tasting_id = p_tasting_id AND lower(email) = v_email AND status <> 'cancelled'
  ) THEN
    RETURN 'already_registered';
  END IF;

  -- Déjà participant (ajouté à la main) : sa réservation remplace ses places au lieu de s'y ajouter.
  SELECT coalesce(tc.seats, 0) INTO v_already
  FROM tasting_customer tc
  WHERE tc.tasting_id = p_tasting_id
    AND tc.customer_id = registration_customer_match(p_tasting_id, p_first_name, p_last_name, v_email);

  v_status := CASE
    WHEN v_capacity IS NULL OR tasting_seats_taken(p_tasting_id) - coalesce(v_already, 0) + p_seats <= v_capacity THEN 'confirmed'
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
    WHERE reg.status = 'confirmed' AND reg.customer_id IS NULL AND t.date >= brussels_today()
    ORDER BY reg.created_at
  LOOP
    PERFORM link_registration_to_customer(r.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.registration_customer_match(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
