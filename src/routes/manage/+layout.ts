/*
 * Gestion rendue dans le navigateur seulement : côté serveur, le client Supabase n'a pas la session
 * de l'admin et lirait la base en visiteur (anon), sans droit sur les prix d'achat (lot.purchase_price).
 */
export const ssr = false;
