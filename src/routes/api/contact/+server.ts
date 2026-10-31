import { json, error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { CONTACT_EMAIL, CONTACT_MIN_FILL_MS, contactReason } from "$lib/contact";
import { escapeHtml, isValidEmail, resendPost } from "$lib/server/email";
import { supabaseAdmin } from "$lib/server/supabaseAdmin";

/**
 * Formulaire de contact public → message enregistré (gestion, page Demandes) et email via Resend
 * (https://resend.com). L'un des deux suffit : le message n'est perdu que si les deux échouent.
 * Variables d'environnement serveur :
 *  - SUPABASE_SERVICE_ROLE_KEY : enregistrement dans contact_message (seul le serveur y écrit,
 *    après les pièges à robots et Turnstile) ;
 *  - RESEND_API_KEY et CONTACT_FROM (ou, à défaut, CAMPAIGN_FROM) : expéditeur sur un domaine vérifié ;
 *  - CONTACT_TO (facultatif) : destinataire, gianni@mezzaterra.be par défaut ;
 *  - TURNSTILE_SECRET_KEY (facultatif) : CAPTCHA Cloudflare Turnstile, exigé dès qu'il est défini.
 * Si ni l'enregistrement ni l'email ne passent, le formulaire propose d'ouvrir la messagerie (mailto).
 */

const MAX_MESSAGE = 5000;

function from(): string | undefined {
  return env.CONTACT_FROM || env.CAMPAIGN_FROM;
}

function enabled(): boolean {
  return Boolean(env.RESEND_API_KEY && from());
}

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return data?.success === true;
}

function renderHtml(rows: [string, string][], message: string): string {
  const table = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#66787a;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const body = escapeHtml(message).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#e8e5de;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#1d2a2c">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#f4f2ed;border-radius:14px;padding:28px" cellspacing="0" cellpadding="0"><tr><td>
<p style="margin:0 0 16px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#5b7d7f">Nouveau message — mezzaterra.be</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="font-size:15px;margin-bottom:20px">${table}</table>
<p style="margin:0;line-height:1.6;font-size:15px">${body}</p>
<p style="margin:24px 0 0;font-size:13px;color:#66787a">Répondez directement à cet email pour écrire à l'expéditeur.</p>
</td></tr></table></body></html>`;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) throw error(400, "Requête invalide");

  /* Pièges à robots : champ invisible rempli ou formulaire envoyé trop vite → on ignore sans le dire. */
  const elapsed = typeof body.elapsed === "number" ? body.elapsed : 0;
  if (clean(body.website) || elapsed < CONTACT_MIN_FILL_MS) return json({ ok: true });

  const reason = contactReason(clean(body.reason)) ?? contactReason("autre")!;
  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 40);
  const subject = clean(body.subject, 200);
  const page = clean(body.page, 300);
  const message = clean(body.message, MAX_MESSAGE);

  if (!firstName) throw error(400, "Merci d’indiquer votre prénom.");
  if (!isValidEmail(email)) throw error(400, "Cette adresse email ne semble pas valide.");
  if (!message) throw error(400, "Votre message est vide.");

  let ip = "";
  try {
    ip = getClientAddress();
  } catch {
    /* Adaptateur sans adresse client : Turnstile s'en passe. */
  }
  if (!(await verifyTurnstile(clean(body.turnstileToken, 4096), ip))) {
    throw error(403, "La vérification anti-robot a échoué. Merci de réessayer.");
  }

  /* Enregistrement et email en parallèle : l'un des deux suffit. */
  const db = supabaseAdmin();
  const save: Promise<boolean> = db
    ? Promise.resolve(
        db
          .from("contact_message")
          .insert({
            reason: reason.id,
            subject: subject || null,
            first_name: firstName,
            last_name: lastName || null,
            email,
            phone: phone || null,
            page: page || null,
            message,
          }),
      ).then(
        ({ error: e }) => {
          if (e) console.error("Message de contact non enregistré :", e.message);
          return !e;
        },
        () => false,
      )
    : Promise.resolve(false);

  if (!enabled()) {
    if (await save) return json({ ok: true });
    throw error(503, "Envoi d'emails non configuré (RESEND_API_KEY / CONTACT_FROM)");
  }

  const name = [firstName, lastName].filter(Boolean).join(" ");
  const rows: [string, string][] = [
    ["Raison", reason.label],
    ["À propos de", subject],
    ["Nom", name],
    ["Email", email],
    ["Téléphone", phone],
    ["Depuis", page],
  ];
  const text = `${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} : ${v}`)
    .join("\n")}\n\n${message}`;

  const send = resendPost("/emails", {
    from: from(),
    to: [env.CONTACT_TO || CONTACT_EMAIL],
    reply_to: name ? `${name.replace(/[<>"]/g, "")} <${email}>` : email,
    subject: `[Contact] ${reason.label}${subject ? ` — ${subject}` : ""} — ${name}`,
    text,
    html: renderHtml(rows, message),
  });
  const [saved, failure] = await Promise.all([save, send]);

  if (failure) {
    if (!saved) throw error(502, "L’envoi a échoué. Merci de réessayer dans un instant.");
    console.error(`Email de contact non envoyé (message enregistré dans Demandes) : ${failure}`);
  }
  return json({ ok: true });
};
