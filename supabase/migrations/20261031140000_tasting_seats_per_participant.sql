-- Places par participant et rattachement plus fin des réservations en ligne.
--
-- 1. Places d'un participant : celles de ses réservations en ligne confirmées s'il en a, calculées à
--    la volée ; sinon tasting_customer.seats, 1 quand il est ajouté à la main, 0 quand il n'est
--    rattaché que par un « J'en veux » pendant la soirée (il occupe déjà la place de celui qui l'a
--    amené). Rien n'est recopié : changer une réservation change aussitôt les places.
-- 2. Une réservation retrouve aussi un participant ajouté à la main sans email, s'il est seul de ce
--    nom dans la dégustation : pas de second client. Ses coordonnées ne sont pas modifiées, car
--    rien ne garantit que l'email saisi sur le site est le sien.
-- 3. Le contrôle de capacité remplace les places d'un participant déjà inscrit à la main par celles
--    de sa réservation, au lieu de les ajouter.
-- 4. Un admin peut rétablir une réservation annulée (par exemple un participant retiré par erreur).

ALTER TABLE public.tasting_customer
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 0 AND 10);

COMMENT ON COLUMN public.tasting_customer.seats IS
  'Places sans réservation en ligne confirmée : 1 ajouté à la main, 0 rattaché par un « J''en veux »';

-- ——— Places prises ———
CREATE OR REPLACE FUNCTION public.participant_seats(p_tasting_id uuid, p_customer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT sum(seats) FROM tasting_registration
      WHERE tasting_id = p_tasting_id AND customer_id = p_customer_id AND status = 'confirmed'
    ),
    (SELECT seats FROM tasting_customer WHERE tasting_id = p_tasting_id AND customer_id = p_customer_id),
    0
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.tasting_seats_taken(p_tasting_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    coalesce((
      SELECT sum(participant_seats(tc.tasting_id, tc.customer_id))
      FROM tasting_customer tc
      WHERE tc.tasting_id = p_tasting_id
    ), 0)
    + coalesce((
      SELECT sum(seats) FROM tasting_registration
      WHERE tasting_id = p_tasting_id AND status = 'confirmed' AND customer_id IS NULL
    ), 0)
  )::integer;
$$;

-- ——— Client d'une réservation, sans en créer ———
-- Même email (de préférence un participant de la dégustation, sinon le client le plus ancien), sinon
-- le seul participant de la dégustation sans email qui porte ce prénom et ce nom.
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
    SELECT c.id INTO v_id
    FROM customer c
    WHERE lower(c.email) = v_email
    ORDER BY EXISTS (
      SELECT 1 FROM tasting_customer tc WHERE tc.tasting_id = p_tasting_id AND tc.customer_id = c.id
    ) DESC, c.created_at
    LIMIT 1;
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
  UPDATE tasting_registration SET customer_id = v_customer WHERE id = r.id;
  INSERT INTO tasting_customer (tasting_id, customer_id) VALUES (r.tasting_id, v_customer) ON CONFLICT DO NOTHING;
  RETURN v_customer;
END;
$$;

-- Gestion : confirmer une réservation (liste d'attente, rattachement qui aurait échoué) ou rétablir une
-- réservation annulée. L'admin décide : la capacité peut être dépassée.
CREATE OR REPLACE FUNCTION public.confirm_tasting_registration(p_registration_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tasting_id uuid;
BEGIN
  PERFORM assert_admin();
  SELECT tasting_id INTO v_tasting_id FROM tasting_registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;
  -- Même verrou que register_for_tasting : pas de calcul de places concurrent.
  PERFORM 1 FROM tasting WHERE id = v_tasting_id FOR UPDATE;
  UPDATE tasting_registration SET status = 'confirmed' WHERE id = p_registration_id;
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
  v_match uuid;
  v_before integer := 0;
  v_after integer := p_seats;
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

  -- Déjà participant (ajouté à la main) : ses places deviennent celles de ses réservations, la
  -- nouvelle comprise, au lieu de s'y ajouter.
  IF v_capacity IS NOT NULL THEN
    v_match := registration_customer_match(p_tasting_id, p_first_name, p_last_name, v_email);
    IF v_match IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM tasting_customer WHERE tasting_id = p_tasting_id AND customer_id = v_match) THEN
        v_before := participant_seats(p_tasting_id, v_match);
      END IF;
      v_after := p_seats + coalesce((
        SELECT sum(seats) FROM tasting_registration
        WHERE tasting_id = p_tasting_id AND customer_id = v_match AND status = 'confirmed'
      ), 0);
    END IF;
  END IF;

  v_status := CASE
    WHEN v_capacity IS NULL OR tasting_seats_taken(p_tasting_id) - v_before + v_after <= v_capacity THEN 'confirmed'
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

-- ——— Réservations existantes des dégustations à venir ———
-- Rattachées à un participant qui a été retiré avant le trigger d'annulation : annulées, comme le
-- ferait aujourd'hui le retrait.
UPDATE public.tasting_registration reg
SET status = 'cancelled'
FROM public.tasting t
WHERE t.id = reg.tasting_id
  AND t.date >= brussels_today()
  AND reg.status = 'confirmed'
  AND reg.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tasting_customer tc WHERE tc.tasting_id = reg.tasting_id AND tc.customer_id = reg.customer_id
  );

-- Confirmées et pas encore rattachées : rattachées, une à une (une erreur n'arrête pas la migration,
-- la réservation reste alors à « Ajouter aux participants » dans Piloter).
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
    BEGIN
      PERFORM link_registration_to_customer(r.id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'Réservation % non rattachée : %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.participant_seats(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registration_customer_match(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
