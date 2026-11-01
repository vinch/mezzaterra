<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { errorMessage } from "$lib/async";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
  import { formatDateLong, formatTime, todayIso } from "$lib/dates";
  import { formatEUR } from "$lib/format";
  import { isPrivateTasting, tastingTitle } from "$lib/publicData";
  import { FLYER_HEIGHT, FLYER_WIDTH, drawTastingFlyer, loadFlyerAssets } from "$lib/tastingFlyer";

  type Recipient = { email: string; unsubscribeId?: string | null; source: string };

  let loading = $state(true);
  let error = $state("");
  let sendEnabled = $state(false);

  let subscribers = $state<{ id: string; email: string }[]>([]);
  let customers = $state<{ email: string; first_name: string }[]>([]);
  let tastings = $state<any[]>([]);
  let registrations = $state<{ email: string; status: string }[]>([]);

  let useSubscribers = $state(true);
  let useCustomers = $state(true);
  let useRegistrants = $state(false);
  let registrantTastingId = $state("");

  let template = $state<"invite" | "reminder" | "free">("invite");
  let tastingId = $state("");
  let subject = $state("");
  let message = $state("");
  let attachFlyer = $state(true);

  let sending = $state(false);
  let confirmOpen = $state(false);
  let result = $state("");
  let copied = $state("");

  onMount(async () => {
    try {
      const [subs, cust, tast, status] = await Promise.all([
        supabase.from("email_subscriber").select("id, email").order("created_at", { ascending: false }),
        supabase.from("customer").select("email, first_name").not("email", "is", null),
        supabase.from("tasting").select("*").order("date", { ascending: false }),
        fetch("/api/campaign")
          .then((r) => (r.ok ? r.json() : { enabled: false }))
          .catch(() => ({ enabled: false })),
      ]);
      subscribers = subs.data || [];
      customers = (cust.data || []).filter((c) => c.email) as any[];
      tastings = tast.data || [];
      sendEnabled = Boolean(status?.enabled);

      const upcoming = tastings.filter((t) => t.date >= todayIso() && !isPrivateTasting(t)).sort((a, b) => a.date.localeCompare(b.date));
      tastingId = upcoming[0]?.id || tastings[0]?.id || "";
      registrantTastingId = tastingId;
      applyTemplate();
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  async function loadRegistrations(id: string) {
    const { data } = await supabase.from("tasting_registration").select("email, status").eq("tasting_id", id);
    registrations = (data || []).filter((r) => r.status !== "cancelled");
  }

  function tastingUrl(t: any, hash = ""): string {
    return `${window.location.origin}/tastings/${t.id}${hash}`;
  }

  function applyTemplate() {
    /* Lecture directe : appelé dans onMount, avant que les déclarations réactives ne se mettent à jour. */
    const t = tastings.find((x) => x.id === tastingId) ?? null;
    const when = t ? `${formatDateLong(t.date)}${t.start_time ? ` à ${formatTime(t.start_time)}` : ""}` : "";
    if (template === "invite" && t) {
      subject = `Invitation — ${tastingTitle(t)}, ${formatDateLong(t.date).toLowerCase()}`;
      message = [
        "Bonjour,",
        `Nous serions ravis de vous accueillir pour notre prochaine dégustation : ${when}${t.location ? `, à ${t.location}` : ""}.`,
        [t.description, t.price ? `Participation : ${formatEUR(t.price)} par personne.` : ""].filter(Boolean).join("\n"),
        `Les places sont limitées — réservez la vôtre ici :\n${tastingUrl(t, "#reserver")}`,
        "À très vite,\nL’équipe Mezzaterra",
      ]
        .filter(Boolean)
        .join("\n\n");
      useRegistrants = false;
    } else if (template === "reminder" && t) {
      subject = `C’est bientôt : ${tastingTitle(t)}`;
      message = [
        "Bonjour,",
        `Petit rappel : nous vous attendons ${when}${t.location ? `, à ${t.location}` : ""}.`,
        `Le soir même, scannez le QR code sur la table pour suivre les vins, les noter et mettre vos coups de cœur de côté :\n${tastingUrl(t, "/live")}`,
        "À demain,\nL’équipe Mezzaterra",
      ].join("\n\n");
      useSubscribers = false;
      useCustomers = false;
      useRegistrants = true;
      registrantTastingId = t.id;
      attachFlyer = false;
    } else if (template === "free") {
      subject = "";
      message = "Bonjour,\n\n\n\nÀ bientôt,\nL’équipe Mezzaterra";
    }
  }

  async function flyerBase64(): Promise<string | null> {
    const t = tastings.find((x) => x.id === tastingId) ?? null;
    if (!t) return null;
    const assets = await loadFlyerAssets();
    const canvas = document.createElement("canvas");
    canvas.width = FLYER_WIDTH;
    canvas.height = FLYER_HEIGHT;
    drawTastingFlyer(canvas.getContext("2d")!, assets, {
      date: t.date,
      time: t.start_time ? t.start_time.slice(0, 5) : "18:30",
      price: Number(t.price ?? 20),
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? null;
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function send() {
    if (!subject.trim() || !message.trim() || recipients.length === 0) return;
    sending = true;
    result = "";
    error = "";
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const content = attachFlyer && template !== "free" ? await flyerBase64() : null;
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          subject,
          text: message,
          recipients: recipients.map((r) => ({ email: r.email, unsubscribeId: r.unsubscribeId })),
          attachment: content ? { filename: "degustation-mezzaterra.png", content } : null,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.message || `Erreur ${res.status}`);
      result = `${out.sent} email${out.sent > 1 ? "s" : ""} envoyé${out.sent > 1 ? "s" : ""}${out.failed ? ` — ${out.failed} échec(s)` : ""}.`;
    } catch (e) {
      error = errorMessage(e);
    } finally {
      sending = false;
    }
  }

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    copied = what;
    setTimeout(() => (copied = ""), 1800);
  }

  $effect.pre(() => {
    if (useRegistrants && registrantTastingId) untrack(() => void loadRegistrations(registrantTastingId));
  });
  let recipients = $derived((() => {
    const map = new Map<string, Recipient>();
    const add = (email: string | null | undefined, source: string, unsubscribeId?: string) => {
      const e = (email || "").trim().toLowerCase();
      if (!e || !e.includes("@")) return;
      const prev = map.get(e);
      map.set(e, { email: e, source: prev ? prev.source : source, unsubscribeId: unsubscribeId ?? prev?.unsubscribeId ?? null });
    };
    if (useSubscribers) for (const s of subscribers) add(s.email, "Newsletter", s.id);
    if (useCustomers) for (const c of customers) add(c.email, "Client");
    if (useRegistrants) for (const r of registrations) add(r.email, "Inscrit");
    /* Les clients aussi abonnés gardent leur lien de désinscription. */
    for (const s of subscribers) {
      const r = map.get(s.email.toLowerCase());
      if (r && !r.unsubscribeId) r.unsubscribeId = s.id;
    }
    return [...map.values()];
  })());
  let mailtoHref = $derived(`mailto:?bcc=${encodeURIComponent(recipients.map((r) => r.email).join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`);
  /* Les clients mail tronquent les URLs trop longues : au-delà, on propose seulement la copie. */
  let mailtoUsable = $derived(mailtoHref.length < 8000);
</script>

<svelte:head>
  <title>Campagnes - Gestion</title>
</svelte:head>

<ManagePageShell title="Campagnes email">
  {#if loading}
    <Spinner />
  {:else}
    {#if error}<div class="error-message" role="alert">{error}</div>{/if}
    {#if result}<div class="success-message">{result}</div>{/if}

    <div class="layout">
      <Card title="1. Message">
        <div class="stack">
          <div class="templates" role="radiogroup" aria-label="Modèle">
            <label class:on={template === "invite"}><input type="radio" bind:group={template} value="invite" onchange={applyTemplate} /> Invitation</label>
            <label class:on={template === "reminder"}><input type="radio" bind:group={template} value="reminder" onchange={applyTemplate} /> Rappel aux inscrits</label>
            <label class:on={template === "free"}><input type="radio" bind:group={template} value="free" onchange={applyTemplate} /> Message libre</label>
          </div>

          {#if template !== "free"}
            <Field id="camp-tasting" label="Dégustation">
              <Select id="camp-tasting" bind:value={tastingId} onchange={applyTemplate}>
                {#each tastings as t}
                  <option value={t.id}>{tastingTitle(t)} — {formatDateLong(t.date)}</option>
                {/each}
              </Select>
            </Field>
          {/if}

          <Field id="camp-subject" label="Objet">
            <input id="camp-subject" class="ui-control" bind:value={subject} />
          </Field>
          <Field id="camp-message" label="Message" help="Texte simple : les liens deviennent cliquables, un lien de désinscription est ajouté pour les abonnés.">
            {#snippet children({ describedby })}
              <textarea id="camp-message" class="ui-control" rows="14" bind:value={message} aria-describedby={describedby}></textarea>
            {/snippet}
          </Field>
          {#if template !== "free"}
            <label class="checkbox-label"><input type="checkbox" bind:checked={attachFlyer} /> Joindre le visuel de la soirée (généré automatiquement)</label>
          {/if}
        </div>
      </Card>

      <Card title="2. Destinataires">
        {#snippet actions()}<span class="count">{recipients.length}</span>{/snippet}
        <div class="stack">
          <label class="checkbox-label"><input type="checkbox" bind:checked={useSubscribers} /> Abonnés newsletter <span class="t-muted">({subscribers.length})</span></label>
          <label class="checkbox-label"><input type="checkbox" bind:checked={useCustomers} /> Clients avec email <span class="t-muted">({customers.length})</span></label>
          <label class="checkbox-label"><input type="checkbox" bind:checked={useRegistrants} /> Inscrits à une dégustation</label>
          {#if useRegistrants}
            <div class="indent">
              <Select bind:value={registrantTastingId} ariaLabel="Dégustation des inscrits">
                {#each tastings as t}
                  <option value={t.id}>{tastingTitle(t)} — {formatDateLong(t.date)}</option>
                {/each}
              </Select>
            </div>
          {/if}
          <p class="t-caption flush">Doublons fusionnés automatiquement.</p>

          <details>
            <summary>Voir la liste</summary>
            <ul class="emails">
              {#each recipients as r}
                <li>{r.email} <span class="t-muted">· {r.source}</span></li>
              {/each}
            </ul>
          </details>

          <h3 class="t-card-title send-title">3. Envoi</h3>
          {#if sendEnabled}
            <Button variant="primary" size="lg" block disabled={sending || !recipients.length || !subject.trim() || !message.trim()} onclick={() => (confirmOpen = true)}>
              {sending ? "Envoi en cours…" : `Envoyer à ${recipients.length} personne${recipients.length > 1 ? "s" : ""}`}
            </Button>
          {:else}
            <p class="notice">
              L’envoi direct n’est pas configuré. Ajoutez <code>RESEND_API_KEY</code> et <code>CAMPAIGN_FROM</code>
              aux variables d’environnement du serveur pour envoyer depuis ici. En attendant :
            </p>
          {/if}
          <div class="fallback">
            <Button onclick={() => copy(recipients.map((r) => r.email).join(", "), "emails")}>
              {copied === "emails" ? "Copié ✓" : "Copier les adresses"}
            </Button>
            <Button onclick={() => copy(message, "message")}>
              {copied === "message" ? "Copié ✓" : "Copier le message"}
            </Button>
            {#if mailtoUsable && recipients.length}
              <Button href={mailtoHref}>Ouvrir ma messagerie (Cci)</Button>
            {/if}
          </div>
        </div>
      </Card>
    </div>
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Envoyer cette campagne ?"
  message="« {subject} » sera envoyé à {recipients.length} destinataire{recipients.length > 1 ? 's' : ''}."
  confirmLabel="Oui, envoyer"
  action={send}
/>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
    gap: 24px;
    align-items: start;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .send-title {
    margin: 16px 0 0;
  }

  .count {
    padding: 2px 10px;
    border-radius: var(--r-pill);
    background: var(--teal-600);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
  }

  .templates {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .templates label {
    padding: 6px 14px;
    border-radius: var(--r-pill);
    border: 1px solid var(--border);
    background: var(--control-bg);
    cursor: pointer;
  }

  .templates label.on {
    background: var(--teal-600);
    border-color: var(--teal-600);
    color: #fff;
  }

  .templates input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .indent {
    margin-left: 26px;
  }

  .flush {
    margin: 0;
  }

  details summary {
    cursor: pointer;
    color: var(--teal-600);
  }

  .emails {
    max-height: 14rem;
    overflow-y: auto;
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 13px;
  }

  .notice {
    margin: 0;
    padding: 12px 14px;
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
    border-radius: var(--r-sm);
  }

  .fallback {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
