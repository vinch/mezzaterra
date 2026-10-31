/**
 * Formulaire de contact du site public (/contact).
 * Chaque appel « Contactez-nous » pointe vers /contact?raison=<id> pour préremplir la raison.
 */

export type ContactReasonId = "prive" | "commande" | "degustation" | "pro" | "autre";

export type ContactReason = {
  id: ContactReasonId;
  label: string;
  placeholder: string;
};

export const CONTACT_REASONS: ContactReason[] = [
  {
    id: "prive",
    label: "Organiser une dégustation privée",
    placeholder: "Pour combien de personnes, où, et vers quelle date ?",
  },
  {
    id: "commande",
    label: "Passer une commande",
    placeholder: "Qu’est-ce qui vous fait envie, et en quelle quantité ?",
  },
  {
    id: "degustation",
    label: "Une question sur nos dégustations",
    placeholder: "Votre question sur une soirée, une réservation…",
  },
  {
    id: "pro",
    label: "Restaurant, caviste ou entreprise",
    placeholder: "Présentez-nous votre établissement ou votre projet.",
  },
  {
    id: "autre",
    label: "Autre chose",
    placeholder: "Votre message",
  },
];

export function contactReason(id: string | null | undefined): ContactReason | undefined {
  return CONTACT_REASONS.find((r) => r.id === id);
}

/** Lien vers le formulaire, raison préremplie (et sujet optionnel : un vin, une soirée…). */
export function contactHref(raison?: ContactReasonId, sujet?: string): string {
  const params = new URLSearchParams();
  if (raison) params.set("raison", raison);
  if (sujet) params.set("sujet", sujet);
  const qs = params.toString();
  return qs ? `/contact?${qs}` : "/contact";
}

/** Destinataire par défaut (surchargé côté serveur par CONTACT_TO). */
export const CONTACT_EMAIL = "gianni@mezzaterra.be";

/** Délai minimal entre l'affichage du formulaire et l'envoi : en dessous, c'est un robot. */
export const CONTACT_MIN_FILL_MS = 3000;
