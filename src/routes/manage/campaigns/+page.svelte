<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { errorMessage } from "$lib/async";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
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

  async function send() {
    if (!subject.trim() || !message.trim() || recipients.length === 0) return;
    if (!confirm(`Envoyer « ${subject} » à ${recipients.length} destinataire${recipients.length > 1 ? "s" : ""} ?`)) return;
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
    {#if error}<div class="error-message">{error}</div>{/if}
    {#if result}<div class="success-message">{result}</div>{/if}

    <div class="layout">
      <section class="card">
        <h2>1. Message</h2>
        <div class="templates" role="radiogroup" aria-label="Modèle">
          <label class:on={template === "invite"}><input type="radio" bind:group={template} value="invite" onchange={applyTemplate} /> Invitation</label>
          <label class:on={template === "reminder"}><input type="radio" bind:group={template} value="reminder" onchange={applyTemplate} /> Rappel aux inscrits</label>
          <label class:on={template === "free"}><input type="radio" bind:group={template} value="free" onchange={applyTemplate} /> Message libre</label>
        </div>

        {#if template !== "free"}
          <div class="form-group">
            <label for="camp-tasting">Dégustation</label>
            <select id="camp-tasting" bind:value={tastingId} onchange={applyTemplate}>
              {#each tastings as t}
                <option value={t.id}>{tastingTitle(t)} — {formatDateLong(t.date)}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="form-group">
          <label for="camp-subject">Objet</label>
          <input id="camp-subject" bind:value={subject} />
        </div>
        <div class="form-group">
          <label for="camp-message">Message</label>
          <textarea id="camp-message" rows="14" bind:value={message}></textarea>
          <small class="hint">Texte simple : les liens deviennent cliquables, un lien de désinscription est ajouté pour les abonnés.</small>
        </div>
        {#if template !== "free"}
          <label class="check"><input type="checkbox" bind:checked={attachFlyer} /> Joindre le visuel de la soirée (généré automatiquement)</label>
        {/if}
      </section>

      <section class="card">
        <h2>2. Destinataires <span class="count">{recipients.length}</span></h2>
        <label class="check"><input type="checkbox" bind:checked={useSubscribers} /> Abonnés newsletter <span class="muted">({subscribers.length})</span></label>
        <label class="check"><input type="checkbox" bind:checked={useCustomers} /> Clients avec email <span class="muted">({customers.length})</span></label>
        <label class="check"><input type="checkbox" bind:checked={useRegistrants} /> Inscrits à une dégustation</label>
        {#if useRegistrants}
          <select class="indent" bind:value={registrantTastingId}>
            {#each tastings as t}
              <option value={t.id}>{tastingTitle(t)} — {formatDateLong(t.date)}</option>
            {/each}
          </select>
        {/if}
        <p class="muted small">Doublons fusionnés automatiquement.</p>

        <details>
          <summary>Voir la liste</summary>
          <ul class="emails">
            {#each recipients as r}
              <li>{r.email} <span class="muted">· {r.source}</span></li>
            {/each}
          </ul>
        </details>

        <h2 class="send-title">3. Envoi</h2>
        {#if sendEnabled}
          <button type="button" class="btn-primary big" disabled={sending || !recipients.length || !subject.trim()} onclick={send}>
            {sending ? "Envoi en cours…" : `Envoyer à ${recipients.length} personne${recipients.length > 1 ? "s" : ""}`}
          </button>
        {:else}
          <p class="notice">
            L’envoi direct n’est pas configuré. Ajoutez <code>RESEND_API_KEY</code> et <code>CAMPAIGN_FROM</code>
            aux variables d’environnement du serveur pour envoyer depuis ici. En attendant :
          </p>
        {/if}
        <div class="fallback">
          <button type="button" class="btn-secondary" onclick={() => copy(recipients.map((r) => r.email).join(", "), "emails")}>
            {copied === "emails" ? "Copié ✓" : "Copier les adresses"}
          </button>
          <button type="button" class="btn-secondary" onclick={() => copy(message, "message")}>
            {copied === "message" ? "Copié ✓" : "Copier le message"}
          </button>
          {#if mailtoUsable && recipients.length}
            <a class="btn-secondary" href={mailtoHref}>Ouvrir ma messagerie (Cci)</a>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</ManagePageShell>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 1.4rem 1.5rem;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.05rem;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .send-title {
    margin-top: 1.75rem;
  }

  .count {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--teal-600);
    color: white;
    font-size: 0.85rem;
  }

  .templates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  .templates label {
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .templates label.on {
    background: var(--teal-600);
    border-color: var(--teal-600);
    color: white;
  }

  .templates input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 1rem;
  }

  .form-group label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group select,
  .form-group textarea,
  .indent {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font: inherit;
    font-size: 0.95rem;
  }

  textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .hint,
  .small {
    font-size: 0.8rem;
  }

  .muted,
  .hint {
    color: var(--ink-2);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.4rem 0;
    cursor: pointer;
  }

  .indent {
    margin: 0.25rem 0 0.5rem 1.6rem;
    width: calc(100% - 1.6rem);
  }

  details summary {
    cursor: pointer;
    font-size: 0.88rem;
    color: var(--teal-600);
  }

  .emails {
    max-height: 14rem;
    overflow-y: auto;
    margin: 0.5rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.85rem;
  }

  .big {
    width: 100%;
    padding: 0.8rem 1rem;
    font-size: 1rem;
  }

  .notice {
    background: #fff9ec;
    border-radius: 8px;
    padding: 0.75rem 0.9rem;
    font-size: 0.88rem;
    color: #6b5a2e;
    margin: 0 0 0.75rem;
  }

  .fallback {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .fallback a {
    text-decoration: none;
  }

  .success-message {
    background: #e3f2e8;
    color: #1f5c36;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
