-- Désinscription respectée dans toutes les campagnes.
-- Avant : se désinscrire supprimait la ligne email_subscriber, mais la même adresse restait dans
-- l'audience « Clients » et recevait la campagne suivante, sans lien de désinscription.
-- Maintenant : email_recipient donne à chaque adresse emailée un jeton de désinscription et garde
-- la date de désinscription. /api/campaign exclut ces adresses de tout envoi (abonnés, clients,
-- inscrits) et met un lien de désinscription dans chaque email.

CREATE TABLE IF NOT EXISTS public.email_recipient (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  unsubscribe_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lecture par les admins ; écritures uniquement par les fonctions ci-dessous.
ALTER TABLE public.email_recipient ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_recipient FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_recipient FROM authenticated;
DROP POLICY IF EXISTS "admins can read" ON public.email_recipient;
CREATE POLICY "admins can read" ON public.email_recipient
  FOR SELECT TO authenticated USING ((SELECT is_admin()));

-- Destinataires d'une campagne (admin) : crée la ligne d'une adresse jamais emailée et renvoie,
-- pour chaque adresse, son jeton et si elle s'est désinscrite.
CREATE OR REPLACE FUNCTION public.campaign_recipients(p_emails text[])
RETURNS TABLE (recipient_email text, token uuid, unsubscribed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_admin();
  INSERT INTO email_recipient (email)
  SELECT DISTINCT lower(btrim(e)) FROM unnest(p_emails) AS e WHERE btrim(coalesce(e, '')) <> ''
  ON CONFLICT (email) DO NOTHING;
  RETURN QUERY
    SELECT r.email, r.unsubscribe_token, r.unsubscribed_at IS NOT NULL
    FROM email_recipient r
    WHERE r.email IN (SELECT lower(btrim(e)) FROM unnest(p_emails) AS e);
END;
$$;

REVOKE ALL ON FUNCTION public.campaign_recipients(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_recipients(text[]) TO authenticated;

-- Lien de désinscription d'un email (/desinscription?t=…) : marque l'adresse désinscrite et la
-- retire des abonnés. Renvoie false pour un jeton inconnu.
CREATE OR REPLACE FUNCTION public.unsubscribe_token(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  UPDATE email_recipient SET unsubscribed_at = coalesce(unsubscribed_at, now())
  WHERE unsubscribe_token = p_token
  RETURNING email INTO v_email;
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM email_subscriber WHERE lower(btrim(email)) = v_email;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_token(uuid) TO anon, authenticated;

-- Anciens liens (/desinscription?id=<abonné>) et « Supprimer » de la page Abonnés : l'adresse est
-- désormais aussi marquée désinscrite, donc exclue des campagnes même comme cliente.
CREATE OR REPLACE FUNCTION public.unsubscribe_email(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  DELETE FROM email_subscriber WHERE id = p_id RETURNING lower(btrim(email)) INTO v_email;
  IF v_email IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO email_recipient (email, unsubscribed_at) VALUES (v_email, now())
  ON CONFLICT (email) DO UPDATE SET unsubscribed_at = coalesce(email_recipient.unsubscribed_at, now());
  RETURN true;
END;
$$;

-- Réinscription : laisser son email sur l'accueil (source « homepage ») annule la désinscription ;
-- une inscription à une dégustation ne réabonne pas une adresse désinscrite.
CREATE OR REPLACE FUNCTION public.email_subscriber_respect_unsubscribe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'homepage' THEN
    UPDATE email_recipient SET unsubscribed_at = NULL WHERE email = lower(btrim(NEW.email));
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM email_recipient
    WHERE email = lower(btrim(NEW.email)) AND unsubscribed_at IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_subscriber_respect_unsubscribe() FROM PUBLIC;

DROP TRIGGER IF EXISTS email_subscriber_respect_unsubscribe ON public.email_subscriber;
CREATE TRIGGER email_subscriber_respect_unsubscribe
  BEFORE INSERT ON public.email_subscriber
  FOR EACH ROW EXECUTE FUNCTION public.email_subscriber_respect_unsubscribe();
