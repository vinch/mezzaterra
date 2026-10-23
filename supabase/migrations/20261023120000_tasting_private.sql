-- Dégustations privées (chez un client, en externe) vs publiques (chez nous).
-- Une dégustation privée n'est pas listée sur le site et refuse les inscriptions en ligne ;
-- sa page et son mode live restent accessibles par lien direct (QR des fiches de table).
-- Additif : une colonne avec valeur par défaut, idempotent.

ALTER TABLE public.tasting
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasting.is_private IS 'Dégustation privée : absente des listes publiques, sans inscription en ligne';

UPDATE public.tasting
SET is_private = true
WHERE date = '2026-03-24' AND name = 'Dégustation XDR';

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
  v_taken integer;
  v_status text;
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

  SELECT coalesce(sum(seats), 0) INTO v_taken
  FROM tasting_registration
  WHERE tasting_id = p_tasting_id AND status = 'confirmed';

  v_status := CASE WHEN v_capacity IS NULL OR v_taken + p_seats <= v_capacity THEN 'confirmed' ELSE 'waitlist' END;

  INSERT INTO tasting_registration (tasting_id, first_name, last_name, email, phone, seats, status)
  VALUES (
    p_tasting_id,
    trim(p_first_name),
    nullif(trim(coalesce(p_last_name, '')), ''),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    p_seats,
    v_status
  );

  -- Best effort : une contrainte inattendue sur email_subscriber ne doit pas bloquer l'inscription.
  BEGIN
    INSERT INTO email_subscriber (email, source) VALUES (v_email, 'registration') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN v_status;
END;
$$;
