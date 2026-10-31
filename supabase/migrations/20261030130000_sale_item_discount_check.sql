-- Remise d'une ligne de vente : jamais négative, au plus 100 % ou au plus le montant de la ligne
-- (prix × quantité). Une ligne qui vaudrait moins de 0 fausserait totaux, marges et la ventilation de
-- TVA par taux des factures. La page Ventes le vérifie aussi, avec un message clair.
-- NOT VALID : contrôle des nouvelles lignes seulement ; une ligne ancienne hors règle n'empêche pas la
-- migration (une vente en attente qui en contient une devra être corrigée pour être réenregistrée).
-- Une remise sans type reste admise : le calcul l'ignore (lignes anciennes).
ALTER TABLE public.sale_item
  ADD CONSTRAINT sale_item_discount_check CHECK (
    coalesce(discount, 0) >= 0
    AND (discount_type IS DISTINCT FROM 'percent' OR discount <= 100)
    AND (discount_type IS DISTINCT FROM 'amount' OR discount <= price * quantity)
  ) NOT VALID;
