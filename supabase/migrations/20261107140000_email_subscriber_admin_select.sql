-- Abonnés lisibles par les admins : email_subscriber n'avait qu'une policy INSERT (formulaire de
-- l'accueil), donc la page Abonnés et les campagnes lisaient une liste vide. Les visiteurs ne lisent
-- toujours rien : RLS reste active et aucune policy SELECT ne les concerne.
ALTER TABLE public.email_subscriber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read" ON public.email_subscriber;
CREATE POLICY "admins can read" ON public.email_subscriber
  FOR SELECT TO authenticated USING ((SELECT is_admin()));
