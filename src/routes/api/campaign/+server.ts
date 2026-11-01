import { createHash } from "node:crypto";
import { json, error } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { env as publicEnv } from "$env/dynamic/public";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import type { Database } from "$lib/database.types";
import { EMAIL_COLORS as C, emailLayout, escapeHtml, isValidEmail, resendPost } from "$lib/server/email";

/**
 * Envoi de campagnes email via Resend (https://resend.com).
 * Variables d'environnement serveur : RESEND_API_KEY et CAMPAIGN_FROM
 * (ex. « Mezzaterra <bonjour@mezzaterra.be> », domaine vérifié chez Resend).
 * Sans ces variables, l'admin retombe sur « copier les adresses / ouvrir ma messagerie ».
 */

type Recipient = { email: string; unsubscribeId?: string | null };
type Attachment = { filename: string; content: string };

const MAX_RECIPIENTS = 500;
const BATCH_SIZE = 100;

function enabled(): boolean {
  return Boolean(env.RESEND_API_KEY && env.CAMPAIGN_FROM);
}

/** Texte brut → HTML sobre aux couleurs Mezzaterra (liens cliquables, paragraphes). */
function renderHtml(text: string, origin: string, unsubscribeUrl: string | null, hasImage: boolean): string {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) =>
      p
        .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${C.teal}">$1</a>`)
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`)
    .join("");

  return emailLayout(
    `<img src="${origin}/logo-simplified.png" alt="Mezzaterra" width="160" style="display:block;margin:0 auto 20px">
${paragraphs}
${hasImage ? `<p style="margin:0 0 16px;color:${C.muted};font-size:14px">Le visuel de la soirée est en pièce jointe.</p>` : ""}`,
    {
      padding: "32px 28px",
      footer: `<p style="font-size:12px;color:${C.muted};margin:16px 0 0">Mezzaterra — vins des Abruzzes${
        unsubscribeUrl ? ` · <a href="${unsubscribeUrl}" style="color:${C.muted}">Se désinscrire</a>` : ""
      }</p>`,
    },
  );
}

/**
 * Clé d'idempotence d'un envoi, tirée de son contenu : relancer la même campagne dans les 24 h
 * (après un échec dont la réponse s'est perdue alors que Resend avait envoyé) n'envoie pas de doublon.
 */
function idempotencyKey(payload: unknown): string {
  return `campaign-${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

async function assertAdmin(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw error(401, "Non authentifié");
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  const key = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw error(500, "Configuration Supabase manquante");
  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error: rpcError } = await client.rpc("is_admin");
  if (rpcError || data !== true) throw error(403, "Accès réservé aux administrateurs");
}

export const GET: RequestHandler = async () => json({ enabled: enabled() });

export const POST: RequestHandler = async ({ request, url }) => {
  if (!enabled()) throw error(503, "Envoi d'emails non configuré (RESEND_API_KEY / CAMPAIGN_FROM)");
  await assertAdmin(request);

  const body = (await request.json().catch(() => null)) as {
    subject?: string;
    text?: string;
    recipients?: Recipient[];
    attachment?: Attachment | null;
  } | null;

  const subject = body?.subject?.trim();
  const text = body?.text?.trim();
  const recipients = (body?.recipients || []).filter((r) => isValidEmail(r?.email || ""));
  if (!subject || !text) throw error(400, "Objet et message obligatoires");
  if (!recipients.length) throw error(400, "Aucun destinataire valide");
  if (recipients.length > MAX_RECIPIENTS) throw error(400, `Maximum ${MAX_RECIPIENTS} destinataires par envoi`);

  const attachment = body?.attachment?.content
    ? [{ filename: body.attachment.filename || "visuel.png", content: body.attachment.content }]
    : undefined;

  let sent = 0;
  /** Destinataires non servis (un lot en échec les compte tous) ; `failures` en donne le détail. */
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((r) => {
      const unsubscribeUrl = r.unsubscribeId ? `${url.origin}/desinscription?id=${r.unsubscribeId}` : null;
      return {
        from: env.CAMPAIGN_FROM,
        to: [r.email],
        subject,
        text: unsubscribeUrl ? `${text}\n\n—\nSe désinscrire : ${unsubscribeUrl}` : text,
        html: renderHtml(text, url.origin, unsubscribeUrl, Boolean(attachment)),
        ...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}),
        ...(attachment ? { attachments: attachment } : {}),
      };
    });

    /* Un échec (même réseau) est compté sans interrompre la campagne : une réponse 500 après des
       emails déjà partis pousserait à relancer l'envoi, donc à envoyer des doublons.
       L'API batch de Resend n'accepte pas les pièces jointes : envoi unitaire dans ce cas. */
    if (attachment) {
      for (const p of payload) {
        const failure = await resendPost("/emails", p, idempotencyKey(p));
        if (failure === null) sent += 1;
        else {
          failed += 1;
          failures.push(`${p.to[0]} : ${failure}`);
        }
      }
    } else {
      const failure = await resendPost("/emails/batch", payload, idempotencyKey(payload));
      if (failure === null) sent += chunk.length;
      else {
        failed += chunk.length;
        failures.push(`Lot ${i / BATCH_SIZE + 1} : ${failure}`);
      }
    }
  }

  return json({ sent, failed, failures });
};
