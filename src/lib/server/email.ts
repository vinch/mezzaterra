import { env } from "$env/dynamic/private";

/** Envoi d'emails via Resend (https://resend.com), partagé par le contact et les campagnes. */

import { errorMessage } from "$lib/async";

export { isValidEmail } from "$lib/contact";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Délai max d'un appel à Resend : au-delà, l'envoi compte comme un échec au lieu de bloquer la route. */
const RESEND_TIMEOUT_MS = 15_000;

/** Motif lisible d'une erreur réseau, avec sa cause (« fetch failed (ECONNRESET) »), jamais vide. */
function networkFailure(e: unknown): string {
  const cause = e instanceof Error ? (e.cause as { code?: string } | undefined) : undefined;
  const message = errorMessage(e) || "Erreur réseau";
  return cause ? `${message} (${cause.code ?? String(cause)})` : message;
}

/**
 * POST sur l'API Resend (`/emails` ou `/emails/batch`) avec la clé du serveur : motif de l'échec,
 * ou `null` si l'envoi est accepté. Ne lève jamais : une erreur réseau ou un délai dépassé est un
 * échec comme un autre. `idempotencyKey` : Resend ignore un second envoi de même clé (24 h).
 */
export async function resendPost(
  path: "/emails" | "/emails/batch",
  payload: unknown,
  idempotencyKey?: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    /* Corps lu dans tous les cas : non consommé, il retiendrait la connexion. */
    const body = await res.text();
    return res.ok ? null : `${res.status} ${body.slice(0, 200)}`.trim();
  } catch (e) {
    return networkFailure(e);
  }
}
