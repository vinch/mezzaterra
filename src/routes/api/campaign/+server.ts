import { json, error } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { env as publicEnv } from "$env/dynamic/public";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import type { Database } from "$lib/database.types";
import { escapeHtml, isValidEmail, resendPost } from "$lib/server/email";
import { errorMessage } from "$lib/async";

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
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#256169">$1</a>')
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`)
    .join("");

  return `<!doctype html><html lang="fr"><body style="margin:0;background:#e8e5de;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#1d2a2c">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#f4f2ed;border-radius:14px;padding:32px 28px" cellspacing="0" cellpadding="0"><tr><td>
<img src="${origin}/logo-simplified.png" alt="Mezzaterra" width="160" style="display:block;margin:0 auto 20px">
${paragraphs}
${hasImage ? '<p style="margin:0 0 16px;color:#66787a;font-size:14px">Le visuel de la soirée est en pièce jointe.</p>' : ""}
</td></tr></table>
<p style="font-size:12px;color:#66787a;margin:16px 0 0">Mezzaterra — vins des Abruzzes${
    unsubscribeUrl ? ` · <a href="${unsubscribeUrl}" style="color:#66787a">Se désinscrire</a>` : ""
  }</p>
</td></tr></table></body></html>`;
}

/**
 * Envoi via Resend : motif de l'échec, ou `null` si l'envoi est accepté. Une erreur réseau
 * compte comme un échec sans interrompre la campagne : une réponse 500 après des emails déjà
 * partis pousserait à relancer l'envoi, donc à envoyer des doublons.
 */
async function trySend(path: "/emails" | "/emails/batch", payload: unknown): Promise<string | null> {
  try {
    const res = await resendPost(path, payload);
    return res.ok ? null : `${res.status} ${(await res.text()).slice(0, 200)}`;
  } catch (e) {
    return errorMessage(e);
  }
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

    /* L'API batch de Resend n'accepte pas les pièces jointes : envoi unitaire dans ce cas. */
    if (attachment) {
      for (const p of payload) {
        const failure = await trySend("/emails", p);
        if (failure) failures.push(`${p.to[0]} : ${failure}`);
        else sent += 1;
      }
    } else {
      const failure = await trySend("/emails/batch", payload);
      if (failure) failures.push(`Lot ${i / BATCH_SIZE + 1} : ${failure}`);
      else sent += chunk.length;
    }
  }

  return json({ sent, failed: failures.length, failures });
};
