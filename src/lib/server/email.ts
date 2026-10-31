import { env } from "$env/dynamic/private";

/** Envoi d'emails via Resend (https://resend.com), partagé par le contact et les campagnes. */

import { errorMessage } from "$lib/async";

export { isValidEmail } from "$lib/contact";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * POST sur l'API Resend (`/emails` ou `/emails/batch`) avec la clé du serveur : motif de l'échec,
 * ou `null` si l'envoi est accepté. Ne lève jamais : une erreur réseau est un échec comme un autre.
 */
export async function resendPost(path: "/emails" | "/emails/batch", payload: unknown): Promise<string | null> {
  try {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok ? null : `${res.status} ${(await res.text()).slice(0, 200)}`;
  } catch (e) {
    return errorMessage(e);
  }
}
