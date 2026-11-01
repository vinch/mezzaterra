import { env } from "$env/dynamic/private";

/** Envoi d'emails via Resend (https://resend.com), partagé par le contact et les campagnes. */

import { errorMessage } from "$lib/async";

export { isValidEmail } from "$lib/contact";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Couleurs des emails, en dur : les messageries ne lisent pas les variables CSS (valeurs des tokens --mz-*). */
export const EMAIL_COLORS = {
  paper: "#e8e5de",
  card: "#f4f2ed",
  ink: "#1d2a2c",
  muted: "#66787a",
  teal: "#256169",
  tealSoft: "#5b7d7f",
} as const;

/**
 * Cadre HTML des emails : fond papier, carte centrée de 560 px qui reçoit `inner`,
 * puis `footer` (facultatif) sous la carte.
 */
export function emailLayout(
  inner: string,
  { padding = "28px", footer = "" }: { padding?: string; footer?: string } = {},
): string {
  const c = EMAIL_COLORS;
  return `<!doctype html><html lang="fr"><body style="margin:0;background:${c.paper};padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:${c.ink}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:${c.card};border-radius:14px;padding:${padding}" cellspacing="0" cellpadding="0"><tr><td>
${inner}
</td></tr></table>${footer ? `\n${footer}` : ""}
</td></tr></table></body></html>`;
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
