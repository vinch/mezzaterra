import { env } from "$env/dynamic/private";

/** Envoi d'emails via Resend (https://resend.com), partagé par le contact et les campagnes. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** POST sur l'API Resend (`/emails` ou `/emails/batch`) avec la clé du serveur. */
export function resendPost(path: "/emails" | "/emails/batch", payload: unknown): Promise<Response> {
  return fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
