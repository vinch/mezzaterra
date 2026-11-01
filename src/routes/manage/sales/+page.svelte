<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { NEW_ROW, supabase } from "$lib/supabase";
  import { getContext, onMount, untrack } from "svelte";
  import type { PageData } from "./$types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import { isEditable, statusMenuItems, STATUS_META, type SaleStatus } from "$lib/status";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import StatusMenuBadge from "$lib/ui/StatusMenuBadge.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
  import AmountTypeInput from "$lib/ui/AmountTypeInput.svelte";
  import Stepper from "$lib/ui/Stepper.svelte";
  import WineDot from "$lib/ui/WineDot.svelte";
  import {
    IconClock,
    IconDownload,
    IconEye,
    IconGlasses,
    IconPencil,
    IconPlus,
    IconReceipt,
    IconSearch,
    IconTrash,
    IconX,
  } from "$lib/ui/icons";
  import { fold, formatDate, formatEUR, initials, toNumber } from "$lib/format";
  import { isoDateOnly, todayIso } from "$lib/dates";
  import { lineTotal } from "$lib/analytics";
  import { styleByKey, vintageProductLabel, vintageShortLabel, wineRobe, type WineStyleKey } from "$lib/wine";
  import {
    PAYMENT_METHOD_OPTIONS,
    SALE_LINE_ITEMS_SELECT,
    TASTING_LINE_NOTE,
    globalDiscountAmount,
    itemsSubtotal,
    lineDiscountError,
    paymentMethodLabel,
    saleItemDescription,
    saleTotal,
  } from "$lib/sales";
  import { fetchCustomers, fetchLineItems, fetchPickerVintages, fetchStockMap } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { invalidateAll } from "$app/navigation";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
  import CustomerAutocomplete from "$lib/components/manage/CustomerAutocomplete.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import Tabs from "$lib/ui/Tabs.svelte";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const { refreshCounts } = getContext<{ refreshCounts: () => void }>("manage");

  /** Valeur interne du select « produit » pour une ligne dégustation (sans millésime). */
  const TASTING_SELECT_VALUE = "__tasting__";

  /* Rechargé par invalidateAll() après une création, une modification ou une suppression. */
  let sales: any[] = $derived(data.sales);
  let customers = $state.raw<any[]>([]);
  let wineVintages = $state.raw<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  /** Modale unique création / édition (`editingSale` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let showDetailsModal = $state(false);
  let editingSale = $state<any>(null);
  let detailsSale = $state<any>(null);
  let detailsSaleItems = $state<any[]>([]);

  // Form fields
  let formData = $state({
    date: todayIso(),
    customer_id: "",
    note: "",
    global_discount: "",
    global_discount_type: "amount" as "amount" | "percent",
    payment_method: "",
    tasting_id: "",
  });

  // Sale items
  let saleItems = $state<any[]>([]);
  let selectedVintageId = $state("");
  let selectedQuantity = $state("");
  let selectedPrice = $state("");
  let selectedDiscount = $state("");
  /** Par défaut « montant » : sinon une remise saisie sans type était ignorée (discount_type null). */
  let selectedDiscountType = $state<"amount" | "percent">("amount");

  onMount(async () => {
    /* Liens profonds depuis le tableau de bord : ?statut=pending, ?nouvelle=1 */
    const params = new URLSearchParams(window.location.search);
    const st = params.get("statut");
    if (st && ["pending", "paid", "delivered", "closed", "cancelled"].includes(st)) tab = st as Tab;
    const t = params.get("degustation");
    if (t) tastingFilter = t;
    try {
      await Promise.all([
        fetchCustomers().then((c) => (customers = c)),
        loadTastings(),
        formLoad.run(fetchVintagesWithStock).then((v) => v && (wineVintages = v)),
      ]);
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
    if (params.has("nouvelle")) {
      /* Stock tout juste lu : relu seulement si le chargement a échoué. */
      if (wineVintages.length && !hasUnknownStock(wineVintages)) showCreateForm();
      /* Chargement en échec : son message reste affiché plutôt qu'un formulaire incomplet. */
      else if (!error) await openCreateModal();
      const client = params.get("client");
      if (client) formData.customer_id = client;
    }
    const facture = params.get("facture");
    if (facture) {
      const sale = sales.find((x) => x.id === facture);
      if (sale) void openDetailsModal(sale);
    }
    const telecharger = params.get("telecharger");
    if (telecharger) void downloadInvoice(telecharger);
  });

  function getProductDisplayNameWithStock(vintage: any, availableStock: number | null) {
    return `${vintageProductLabel(vintage)} - Stock : ${availableStock ?? "indisponible"}`;
  }

  /** Bouteilles encore ajoutables ; null si le stock est illisible (rien d'ajoutable). */
  function getAvailableStock(vintageId: string): number | null {
    if (vintageId === TASTING_SELECT_VALUE) {
      return 999999;
    }
    const vintage = vintageById.get(vintageId);
    if (!vintage) return 0;
    if (vintage.stock == null) return null;

    const stock = vintage.stock;
    // Subtract quantities already in saleItems
    const alreadyAdded = saleItems
      .filter((item) => item.wine_vintage_id === vintageId)
      .reduce((sum, item) => sum + (item.quantity || 0), 0);

    return Math.max(0, stock - alreadyAdded);
  }

  function isVintageAlreadyAdded(vintageId: string): boolean {
    if (vintageId === TASTING_SELECT_VALUE) {
      return false;
    }
    return saleItems.some((item) => item.wine_vintage_id === vintageId);
  }

  /**
   * Millésimes du sélecteur avec leur stock, relu à chaque ouverture du formulaire (le
   * catalogue n'est lu qu'une fois). Stock illisible : `stock` vaut null ; on ne peut plus
   * ajouter de bouteilles ni en augmenter, mais une vente reste modifiable (paiement…).
   */
  async function fetchVintagesWithStock(): Promise<any[]> {
    const [list, stock] = await Promise.all([
      wineVintages.length ? wineVintages : fetchPickerVintages(),
      fetchStockMap().catch((e) => {
        console.error(e);
        return null;
      }),
    ]);
    return list.map((v) => ({ ...v, stock: stock ? (stock.get(v.id) ?? 0) : null }));
  }
  const hasUnknownStock = (list: any[]) => list.some((v) => v.stock == null);

  /* Chargements des modales : le dernier clic gagne (deux « Modifier » enchaînés…). */
  const formLoad = latestOnly((e) => (error = errorMessage(e)));

  function showCreateForm() {
    editingSale = null;
    resetForm();
    formOpen = true;
  }

  async function openCreateModal() {
    error = "";
    /* Stock relu : des ventes ont pu être payées depuis l'ouverture de la page. */
    const vintages = await formLoad.run(fetchVintagesWithStock);
    if (!vintages) return;
    wineVintages = vintages;
    showCreateForm();
  }

  async function openEditModal(sale: any) {
    error = "";
    /* Stock relu : il a pu bouger depuis l'ouverture de la page. */
    const loaded = await formLoad.run(() => Promise.all([fetchVintagesWithStock(), loadSaleItems(sale.id)]));
    if (!loaded) return;
    const [vintages, items] = loaded;

    wineVintages = vintages;
    editingSale = sale;
    formData = {
      date: isoDateOnly(sale.date),
      customer_id: sale.customer_id || "",
      note: sale.note || "",
      global_discount:
        sale.global_discount != null && toNumber(sale.global_discount) > 0
          ? String(sale.global_discount)
          : "",
      global_discount_type:
        sale.global_discount_type === "percent" ? "percent" : "amount",
      payment_method: sale.payment_method ?? "",
      tasting_id: sale.tasting_id ?? "",
    };
    /* Le stock d'une ligne est lu dans vintageById (liste tout juste relue). */
    saleItems = items.map((item: any) => ({
      wine_vintage: item.wine_vintage,
      wine_vintage_id: item.wine_vintage_id ?? null,
      quantity: item.quantity,
      /* Plafond si le stock est illisible : on peut revenir à la quantité enregistrée. */
      saved_quantity: item.quantity,
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      discount_type: item.discount_type || null,
      note: item.note || (item.wine_vintage_id ? "" : TASTING_LINE_NOTE),
    }));
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
    selectedDiscount = "";
    selectedDiscountType = "amount";
    formOpen = true;
  }

  const loadSaleItems = (saleId: string) => fetchLineItems("sale", saleId, SALE_LINE_ITEMS_SELECT);

  function closeForm() {
    formOpen = false;
    editingSale = null;
    resetForm();
  }

  async function openDetailsModal(sale: any) {
    const items = await formLoad.run(() => loadSaleItems(sale.id));
    if (!items) return;
    detailsSaleItems = items;
    detailsSale = sale;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsSale = null;
    detailsSaleItems = [];
  }

  async function downloadInvoice(saleId: string) {
    try {
      /* jsPDF n'est chargé qu'au moment de générer une facture. */
      const { downloadInvoicePdf } = await import("$lib/pdf/invoicePdf");
      await downloadInvoicePdf(saleId);
    } catch (err) {
      error = `Erreur lors de la génération de la facture : ${errorMessage(err)}`;
      console.error(err);
    }
  }

  function resetForm() {
    formData = {
      date: todayIso(),
      customer_id: "",
      note: "",
      global_discount: "",
      global_discount_type: "amount",
      payment_method: "",
      tasting_id: tastingOnDate(todayIso()),
    };
    saleItems = [];
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
    selectedDiscount = "";
    selectedDiscountType = "amount";
  }

  function handleVintageChange() {
    if (selectedVintageId === TASTING_SELECT_VALUE) {
      selectedPrice = "";
      return;
    }
    if (selectedVintageId) {
      const vintage = wineVintages.find((v) => v.id === selectedVintageId);
      if (vintage && vintage.price) {
        selectedPrice = vintage.price.toString();
      }
    }
  }

  function addSaleItem() {
    if (!selectedQuantity || !selectedPrice) return;

    const discountVal = toNumber(selectedDiscount);
    if (discountVal > 0 && !selectedDiscountType) {
      error = "Choisissez un type de remise (montant ou %).";
      return;
    }

    const quantity = parseInt(String(selectedQuantity), 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      error = "Quantité invalide";
      return;
    }

    const discountError = lineDiscountError({
      price: selectedPrice,
      quantity,
      discount: discountVal,
      discount_type: selectedDiscountType,
    });
    if (discountError) {
      error = discountError;
      return;
    }

    if (selectedVintageId === TASTING_SELECT_VALUE) {
      saleItems = [
        ...saleItems,
        {
          wine_vintage: null,
          wine_vintage_id: null,
          quantity,
          price: toNumber(selectedPrice),
          discount: discountVal,
          discount_type: discountVal > 0 ? selectedDiscountType || null : null,
          note: TASTING_LINE_NOTE,
        },
      ];
      selectedVintageId = "";
      selectedQuantity = "";
      selectedPrice = "";
      selectedDiscount = "";
      selectedDiscountType = "amount";
      error = "";
      return;
    }

    if (!selectedVintageId) return;

    const availableStock = getAvailableStock(selectedVintageId);

    if (availableStock == null) {
      error = "Stock indisponible : impossible d’ajouter des bouteilles pour l’instant.";
      return;
    }
    if (quantity > availableStock) {
      error = `Stock insuffisant. Stock disponible: ${availableStock}`;
      return;
    }

    const vintage = wineVintages.find((v) => v.id === selectedVintageId);
    if (vintage) {
      saleItems = [
        ...saleItems,
        {
          wine_vintage: vintage,
          wine_vintage_id: selectedVintageId,
          quantity: quantity,
          price: toNumber(selectedPrice),
          discount: discountVal,
          discount_type: discountVal > 0 ? selectedDiscountType || null : null,
          note: "",
        },
      ];
      selectedVintageId = "";
      selectedQuantity = "";
      selectedPrice = "";
      selectedDiscount = "";
      selectedDiscountType = "amount";
      error = ""; // Clear any previous errors
    }
  }

  function removeSaleItem(index: number) {
    saleItems = saleItems.filter((_, i) => i !== index);
    // Réinitialise le select (évite bug navigateur quand une option repasse de disabled → enabled)
    selectedVintageId = "";
  }

  /** Création ou modification (selon `editingSale`) de la vente et de ses lignes. */
  async function submitForm() {
    if (saving) return;
    if (!formData.customer_id || saleItems.length === 0) {
      error = "Le client et au moins un article sont obligatoires";
      return;
    }

    const gGlobal = toNumber(formData.global_discount);
    if (
      gGlobal > 0 &&
      formData.global_discount_type === "percent" &&
      gGlobal > 100
    ) {
      error = "La ristourne globale en pourcentage ne peut pas dépasser 100 %.";
      return;
    }
    /* Une vente reprise peut contenir une ligne saisie avant ce contrôle : la base la refuserait. */
    const badLine = saleItems.find((item) => lineDiscountError(item));
    if (badLine) {
      error = `${saleItemDescription(badLine)} : ${lineDiscountError(badLine)} Retirez la ligne et ajoutez-la de nouveau.`;
      return;
    }
    if (gGlobal > 0 && formData.global_discount_type === "amount" && gGlobal > itemsSubtotal(saleItems)) {
      error = "La ristourne globale dépasse le sous-total de la vente.";
      return;
    }

    const saleData = {
      date: formData.date,
      customer_id: formData.customer_id,
      total_price: total,
      note: formData.note || null,
      global_discount: gGlobal > 0 ? gGlobal : null,
      global_discount_type: gGlobal > 0 ? formData.global_discount_type : null,
      payment_method: formData.payment_method?.trim()
        ? formData.payment_method.trim()
        : null,
      tasting_id: formData.tasting_id || null,
    };

    saving = true;
    try {
      /* Vente et lignes enregistrées ensemble (fonction SQL save_sale) : tout ou rien. */
      const { error: saveError } = await supabase.rpc("save_sale", {
        p_sale_id: editingSale?.id ?? NEW_ROW,
        p_sale: saleData,
        p_items: saleItems.map((item) => ({
          wine_vintage_id: item.wine_vintage_id ?? null,
          quantity: item.quantity,
          price: toNumber(item.price),
          discount: toNumber(item.discount) > 0 ? toNumber(item.discount) : null,
          discount_type: item.discount_type || null,
          note: item.note || null,
        })),
      });

      if (saveError) {
        error = saveError.message;
        return;
      }

      error = "";
      closeForm();
      await invalidateAll();
      refreshCounts();
    } finally {
      saving = false;
    }
  }

  /**
   * Changement de statut. Les règles (transitions permises, mode de paiement obligatoire), le
   * déstockage et le numéro de facture sont appliqués par la fonction SQL set_sale_status, en une
   * transaction ; ici, seulement les confirmations et un rappel du mode de paiement avant de demander.
   */
  async function updateSaleStatus(sale: any, newStatus: string): Promise<boolean> {
    const currentStatus = sale.status;
    if (currentStatus === newStatus) {
      return true;
    }

    const stockHint =
      currentStatus === "pending" ? "\n\nLe stock sera débité (hors lignes dégustation)." : "";

    /* Mode de paiement manquant : demandé ici, la facture en a besoin (une vente livrée n'est plus modifiable). */
    let paymentMethod: string | null = null;
    if (newStatus === "paid" || newStatus === "closed") {
      /* Relu en base : le mode de paiement a pu être saisi ailleurs depuis le chargement de la page. */
      const { data: fresh, error: freshError } = await supabase.from("sale").select("payment_method").eq("id", sale.id).single();
      if (freshError) {
        error = freshError.message;
        return false;
      }
      if (!String(fresh?.payment_method ?? "").trim()) {
        paymentMethod = await askPaymentMethod(
          newStatus === "paid"
            ? {
                action: "Marquer comme payée",
                note: `Un numéro de facture sera attribué si besoin.${stockHint ? " Le stock sera débité (hors lignes dégustation)." : ""}`,
              }
            : { action: "Clôturer et facturer", note: "La vente ne pourra plus être modifiée ni changer de statut." },
        );
        if (!paymentMethod) return false;
      }
    }

    const question =
      newStatus === "closed"
        ? "Clôturer cette vente ?\n\nElle ne pourra plus être modifiée ni changer de statut."
        : newStatus === "delivered"
          ? `Marquer cette vente comme livrée ?${stockHint}`
          : newStatus === "paid"
            ? `Marquer cette vente comme payée ?${stockHint}\n\nUn numéro de facture sera attribué si besoin.`
            : null;
    /* La fenêtre du mode de paiement vaut confirmation. */
    if (question && !paymentMethod && !confirm(question)) {
      return false;
    }

    const { data: invoiceNumber, error: statusError } = await supabase.rpc("set_sale_status", {
      p_sale_id: sale.id,
      p_status: newStatus,
      p_payment_method: paymentMethod ?? undefined,
    });

    if (statusError) {
      error = statusError.message;
      return false;
    }

    /* Objet neuf pour la ligne : la liste ($derived, sans proxy) ne suit pas les mutations. */
    sales = sales.map((s) =>
      s.id === sale.id
        ? { ...s, status: newStatus, invoice_number: invoiceNumber, payment_method: paymentMethod ?? s.payment_method }
        : s,
    );

    return true;
  }

  /* Fenêtre « Mode de paiement » : résolue par le choix, ou null si on annule. Elle vaut confirmation. */
  type PaymentAsk = { action: string; note: string };
  let paymentPrompt = $state<(PaymentAsk & { resolve: (method: string | null) => void }) | null>(null);
  let paymentChoice = $state("");
  function askPaymentMethod(ask: PaymentAsk): Promise<string | null> {
    paymentPrompt?.resolve(null);
    paymentChoice = "";
    return new Promise((resolve) => (paymentPrompt = { ...ask, resolve }));
  }
  function answerPayment(method: string | null) {
    paymentPrompt?.resolve(method);
    paymentPrompt = null;
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteSale(id: string) {
    const sale = sales.find((s) => s.id === id);
    if (sale && !isEditable("sale", sale.status)) {
      error = "Seules les ventes en attente peuvent être supprimées.";
      return;
    }

    /* Filtrée sur « En attente » : une vente passée entre-temps ailleurs (stock déjà sorti) n'est pas supprimée. */
    const { data: deleted, error: deleteError } = await supabase
      .from("sale")
      .delete()
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (deleteError || !deleted?.length) {
      error = deleteError?.message ?? "Seules les ventes en attente peuvent être supprimées.";
      return;
    }

    error = "";
    await invalidateAll();
    refreshCounts();
  }

  /* ——— Dégustations (lien vente ↔ dégustation) ——— */
  let tastings = $state<{ id: string; name: string | null; date: string }[]>([]);
  async function loadTastings() {
    const { data } = await supabase.from("tasting").select("id, name, date").order("date", { ascending: false });
    tastings = data || [];
  }
  /** Dégustation unique ayant lieu à cette date (sinon chaîne vide). */
  function tastingOnDate(date: string): string {
    const same = tastings.filter((t) => t.date === date);
    return same.length === 1 ? same[0].id : "";
  }
  function tastingLabel(id: string | null | undefined): string {
    const t = id ? tastingById.get(id) : undefined;
    return t ? `${t.name || "Dégustation"} · ${formatDate(t.date)}` : "";
  }
  /* Nouvelle vente : la dégustation suit la date tant qu'on ne l'a pas choisie à la main. */
  let tastingTouched = $state(false);
  let lastDate = $state("");
  let tastingFilter = $state("");

  /* ——— Interface (refonte) : filtres, menus, confirmation ——— */
  type Tab = "all" | SaleStatus;
  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "pending", label: STATUS_META.pending.plural },
    { key: "paid", label: STATUS_META.paid.plural },
    { key: "delivered", label: STATUS_META.delivered.plural },
    { key: "closed", label: STATUS_META.closed.plural },
    { key: "cancelled", label: STATUS_META.cancelled.plural },
  ];
  let tab = $state<Tab>("all");
  let search = $state("");
  let period = $state("all");

  function customerName(s: any): string {
    return s?.customer ? `${s.customer.first_name} ${s.customer.last_name}`.trim() : "—";
  }

  /* Changement de statut depuis le badge (mêmes transitions que l'ancien sélecteur). */
  function saleStatusItems(sale: any): MenuItem[] {
    return statusMenuItems("sale", sale.status, (next) => changeStatus(sale, next));
  }
  async function changeStatus(sale: any, next: string) {
    error = "";
    if (await updateSaleStatus(sale, next)) refreshCounts();
  }

  function rowItems(sale: any): MenuItem[] {
    const st = sale.status;
    const items: MenuItem[] = [];
    if (st === "closed" || st === "cancelled") {
      items.push({ label: "Voir le détail", icon: IconEye, onSelect: () => openDetailsModal(sale) });
      if (st === "closed") {
        items.push({ label: "Télécharger la facture", icon: IconDownload, onSelect: () => downloadInvoice(sale.id) });
      }
      return items;
    }
    items.push({ label: "Ouvrir", icon: IconEye, onSelect: () => openDetailsModal(sale) });
    /* Payée ou livrée, la vente a sorti son stock : elle est figée (save_sale le refuse aussi). */
    if (isEditable("sale", st)) items.push({ label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(sale) });
    items.push(...saleStatusItems(sale));
    if (isEditable("sale", st)) {
      items.push({ label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(sale) });
    }
    return items;
  }

  function openRow(sale: any, e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, [role=menu]")) return;
    openDetailsModal(sale);
  }

  let deleteTarget = $state<any>(null);
  let confirmOpen = $state(false);
  let deleting = $state(false);
  function askDelete(sale: any) {
    deleteTarget = sale;
    confirmOpen = true;
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    deleting = true;
    await deleteSale(deleteTarget.id);
    deleting = false;
    confirmOpen = false;
  }

  function setItemQuantity(index: number, q: number) {
    saleItems = saleItems.map((it, i) => (i === index ? { ...it, quantity: q } : it));
  }

  let customerHint = $state("");
  let hintFor = $state("");
  async function loadCustomerHint(id: string) {
    hintFor = id;
    customerHint = "";
    const own = sales.filter((s) => s.customer_id === id && s.status !== "cancelled");
    const last = own.map((s) => String(s.date)).sort().pop();
    const { data } = await supabase
      .from("sale_item")
      .select("quantity, sale_id, wine_vintage ( wine ( wine_type ( name, kind ) ) )")
      .in("sale_id", own.map((s) => s.id).slice(0, 100));
    const byRobe = new Map<WineStyleKey, number>();
    for (const it of (data || []) as any[]) {
      const r = wineRobe(it.wine_vintage?.wine?.wine_type).key;
      if (r === "red" || r === "white" || r === "rose") byRobe.set(r, (byRobe.get(r) ?? 0) + (it.quantity || 0));
    }
    const fav = [...byRobe.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (hintFor !== id) return;
    customerHint = [
      fav ? `Aime les ${styleByKey(fav).label.toLowerCase()}s` : "",
      last ? `dernier achat le ${formatDate(last)}` : "premier achat",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  function clearCustomer() {
    formData.customer_id = "";
    hintFor = "";
    customerHint = "";
  }
  let stockUnknown = $derived(hasUnknownStock(wineVintages));
  let total = $derived(saleTotal(saleItems, formData.global_discount, formData.global_discount_type));
  let tastingById = $derived(new Map(tastings.map((t) => [t.id, t])));
  $effect.pre(() => {
    if (!formOpen) tastingTouched = false;
  });
  $effect.pre(() => {
    if (formOpen && !editingSale && formData.date !== lastDate) {
      lastDate = formData.date;
      if (!tastingTouched) formData.tasting_id = untrack(() => tastingOnDate(formData.date));
    }
  });
  let years = $derived([...new Set(sales.map((s) => String(s.date).slice(0, 4)))].sort().reverse());
  let periodSales = $derived(sales
    .filter((s) => period === "all" || String(s.date).startsWith(period))
    .filter((s) => !tastingFilter || (tastingFilter === "none" ? !s.tasting_id : s.tasting_id === tastingFilter)));
  let tabItems = $derived(TABS.map((t) => ({
    ...t,
    count: t.key === "all" ? periodSales.length : periodSales.filter((s) => s.status === t.key).length,
  })));
  let visibleSales = $derived(periodSales
    .filter((s) => tab === "all" || s.status === tab)
    .filter((s) => {
      const q = fold(search.trim());
      if (!q) return true;
      const c = s.customer || {};
      return fold(`${c.first_name ?? ""} ${c.last_name ?? ""} ${c.company_name ?? ""} ${s.invoice_number ?? ""}`).includes(q);
    }));
  let pendingCount = $derived(sales.filter((s) => s.status === "pending").length);
  let subtitle = $derived(`${periodSales.length} vente${periodSales.length > 1 ? "s" : ""}${period === "all" ? "" : ` en ${period}`} · ${pendingCount} en attente de paiement`);
  let grossTotal = $derived(Math.round(
    saleItems.reduce((sum, it) => sum + toNumber(it.price) * (parseInt(String(it.quantity ?? 0), 10) || 0), 0) * 100,
  ) / 100);
  let discountsTotal = $derived(Math.max(0, Math.round((grossTotal - total) * 100) / 100));
  let bottleCount = $derived(saleItems.reduce((n, it) => n + (it.wine_vintage_id ? parseInt(String(it.quantity), 10) || 0 : 0), 0));
  let vintageById = $derived(new Map(wineVintages.map((v) => [v.id, v])));
  /* Client choisi : puce + aide (goûts, dernier achat). */
  let selectedCustomer = $derived(customers.find((c) => c.id === formData.customer_id) ?? null);
  $effect.pre(() => {
    const id = formData.customer_id;
    if (formOpen && id && id !== hintFor) untrack(() => void loadCustomerHint(id));
  });
</script>


<svelte:head>
  <title>Ventes - Gestion</title>
</svelte:head>

<ManagePageShell title="Ventes" {subtitle}>
  {#snippet actions()}
      <Button variant="primary" onclick={openCreateModal}>
        <IconPlus size={18} strokeWidth={1.75} /> <span class="label-long">Nouvelle vente</span><span class="label-short">Nouvelle</span>
      </Button>
  {/snippet}

  {#snippet tabs()}
      <Tabs label="Filtrer par statut" items={tabItems} bind:value={tab} />
  {/snippet}

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  <div class="toolbar">
    <label class="search">
      <span class="sr-only">Rechercher un client ou un n° de facture</span>
      <IconSearch size={16} strokeWidth={1.75} aria-hidden="true" />
      <input class="ui-control" type="search" placeholder="Client, n° de facture…" bind:value={search} />
    </label>
    <div class="period">
      <Select bind:value={tastingFilter} ariaLabel="Dégustation">
        <option value="">Toutes les dégustations</option>
        <option value="none">Hors dégustation</option>
        {#each tastings as t}
          <option value={t.id}>{t.name || "Dégustation"} · {formatDate(t.date)}</option>
        {/each}
      </Select>
    </div>
    <div class="period">
      <Select bind:value={period} ariaLabel="Période">
        <option value="all">Toutes les périodes</option>
        {#each years as y}
          <option value={y}>Toute l’année {y}</option>
        {/each}
      </Select>
    </div>
  </div>

  {#if loading}
    <Spinner />
  {:else if sales.length === 0}
    <div class="empty-card">
      <EmptyState icon={IconReceipt} title="Aucune vente pour l’instant" text="Créez la première vente : elle sera enregistrée « En attente ».">
        <Button onclick={openCreateModal}>Créer la première vente</Button>
      </EmptyState>
    </div>
  {:else if visibleSales.length === 0}
    <div class="empty-card">
      <EmptyState icon={IconSearch} title="Aucune vente ne correspond" text="Essayez un autre statut, une autre période ou une autre recherche." compact />
    </div>
  {:else}
    <!-- Ordinateur : tableau -->
    <div class="desktop-only">
      <DataTable caption="Liste des ventes">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Client</th>
            <th scope="col">Statut</th>
            <th scope="col" class="num">Montant TTC</th>
            <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each visibleSales as sale (sale.id)}
            <tr class="is-clickable" onclick={(e) => openRow(sale, e)}>
              <td>{formatDate(sale.date)}</td>
              <td>
                <button type="button" class="link-cell" onclick={() => openDetailsModal(sale)}>{customerName(sale)}</button>
                {#if sale.customer?.company_name}<span class="t-muted">&nbsp;· {sale.customer.company_name}</span>{/if}
                {#if sale.tasting_id}<span class="tasting-tag" title={tastingLabel(sale.tasting_id)}><IconGlasses size={12} strokeWidth={1.75} aria-hidden="true" />{tastingById.get(sale.tasting_id)?.name || "Dégustation"}</span>{/if}
              </td>
              <td>
                <StatusMenuBadge status={sale.status} onselect={(next) => changeStatus(sale, next)} />
              </td>
              <td class="num">
                {#if sale.status === "cancelled"}
                  <span class="t-caption">hors CA</span> <s class="t-muted">{formatEUR(sale.total_price)}</s>
                {:else}
                  <strong>{formatEUR(sale.total_price)}</strong>
                {/if}
              </td>
              <td class="col-actions">
                <div class="row-actions">
                  {#if sale.status === "closed"}
                    <IconButton label="Télécharger la facture" onclick={() => downloadInvoice(sale.id)}>
                      <IconDownload size={18} strokeWidth={1.75} />
                    </IconButton>
                  {/if}
                  <RowMenu items={rowItems(sale)} label="Actions pour la vente de {customerName(sale)}" />
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </DataTable>
    </div>

    <!-- Mobile : cartes empilées -->
    <ul class="cards mobile-only">
      {#each visibleSales as sale (sale.id)}
        <li class="sale-card">
          <button type="button" class="sale-card-main" onclick={() => openDetailsModal(sale)}>
            <span class="sc-top">
              <strong class="sc-name">{customerName(sale)}{sale.customer?.company_name ? ` (${sale.customer.company_name})` : ""}</strong>
              {#if sale.status === "cancelled"}
                <s class="t-muted">{formatEUR(sale.total_price)}</s>
              {:else}
                <strong>{formatEUR(sale.total_price)}</strong>
              {/if}
            </span>
            <span class="sc-bottom">
              <StatusBadge status={sale.status} />
              <span class="t-muted">{formatDate(sale.date)}</span>
            </span>
          </button>
          <RowMenu items={rowItems(sale)} label="Actions pour la vente de {customerName(sale)}" />
        </li>
      {/each}
    </ul>
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer cette vente ?"
  busy={deleting}
  message={deleteTarget
    ? `La vente du ${formatDate(deleteTarget.date)} à ${customerName(deleteTarget)} (${formatEUR(deleteTarget.total_price)}) sera définitivement supprimée, avec ses articles. Le stock n’est pas modifié : une vente en attente ne l’a pas encore débité.`
    : ""}
  onconfirm={confirmDelete}
/>

<Modal open={!!paymentPrompt} title="Mode de paiement" maxWidth={440} onclose={() => answerPayment(null)}>
  <Field id="paid-payment" label="Mode de paiement" help={paymentPrompt?.note}>
    {#snippet children({ describedby })}
      <select id="paid-payment" class="ui-control" bind:value={paymentChoice} aria-describedby={describedby}>
        <option value="">Choisir…</option>
        {#each PAYMENT_METHOD_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    {/snippet}
  </Field>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => answerPayment(null)}>Annuler</Button>
    <Button variant="primary" disabled={!paymentChoice} onclick={() => answerPayment(paymentChoice)}>{paymentPrompt?.action}</Button>
  {/snippet}
</Modal>

<!-- Création / modification -->
<Modal open={formOpen} title={editingSale ? "Modifier la vente" : "Nouvelle vente"} maxWidth={820} onclose={closeForm}>
  {#snippet titleExtra()}
    {#if editingSale}
      <StatusBadge status="pending" />
    {:else}
      <span class="will-be"><IconClock size={14} strokeWidth={1.75} aria-hidden="true" /> Sera créée « En attente »</span>
    {/if}
  {/snippet}

  <form id="sale-form" class="sale-form" onsubmit={preventDefault(submitForm)}>
    {#if error && formOpen}
      <div class="error-message" role="alert">{error}</div>
    {/if}
    {#if stockUnknown && formOpen}
      <div class="error-message" role="alert">Stock indisponible : impossible d’ajouter des bouteilles pour l’instant.</div>
    {/if}

    <div class="grid-2">
      <Field id="sale-date" label="Date" required>
        <input id="sale-date" class="ui-control" type="date" bind:value={formData.date} required />
      </Field>

      <Field id="sale-customer" label="Client" required>
        {#if selectedCustomer}
          <div class="chip">
            <span class="chip-avatar" aria-hidden="true">{initials(selectedCustomer.first_name, selectedCustomer.last_name)}</span>
            <span class="chip-name">
              <strong>{selectedCustomer.first_name} {selectedCustomer.last_name}</strong>{#if selectedCustomer.city}<span class="t-muted">&nbsp;· {selectedCustomer.city}</span>{/if}
            </span>
            <IconButton label="Changer de client" onclick={clearCustomer}><IconX size={16} strokeWidth={1.75} /></IconButton>
          </div>
          <p class="t-caption hint">
            {customerHint}{customerHint ? " · " : ""}<a href="/manage/customers/{selectedCustomer.id}" target="_blank" rel="noopener noreferrer">voir la fiche</a>
          </p>
        {:else}
          <CustomerAutocomplete id="sale-customer" bind:value={formData.customer_id} customers={customers} placeholder="Rechercher un client…" />
        {/if}
      </Field>
    </div>

    <section class="items" aria-labelledby="items-title">
      <div class="items-head">
        <h3 id="items-title" class="t-label">Articles <span class="req" aria-hidden="true">*</span></h3>
        {#if saleItems.length}
          <span class="t-caption">{saleItems.length} ligne{saleItems.length > 1 ? "s" : ""} · {bottleCount} bt.</span>
        {/if}
      </div>

      <div class="items-box">
        {#if saleItems.length === 0}
          <EmptyState title="Aucun article ajouté" text="Cherchez un produit ci-dessous, puis « Ajouter »." compact />
        {:else}
          <div class="items-scroll">
            <table class="ui-table items-table">
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col">Quantité</th>
                  <th scope="col" class="num">Prix unit.</th>
                  <th scope="col" class="num">Remise</th>
                  <th scope="col" class="num">Total</th>
                  <th scope="col"><span class="sr-only">Retirer</span></th>
                </tr>
              </thead>
              <tbody>
                {#each saleItems as item, index}
                  {@const v = vintageById.get(item.wine_vintage_id) ?? item.wine_vintage}
                  <!-- Stock du millésime ; null pour une ligne dégustation ou un stock illisible. -->
                  {@const stock = item.wine_vintage_id ? (v?.stock ?? null) : null}
                  {@const qty = parseInt(String(item.quantity), 10) || 1}
                  <tr>
                    <td>
                      <span class="wine-cell">
                        {#if item.wine_vintage_id}
                          <WineDot type={v?.wine?.wine_type} />
                        {/if}
                        <span class="wine-name">
                          {#if item.wine_vintage_id && v?.wine}
                            <strong>{vintageShortLabel(v)}</strong>
                            <span class="t-caption">{v.wine.winery?.name ?? ""}</span>
                          {:else}
                            <strong>{saleItemDescription(item)}</strong>
                          {/if}
                        </span>
                      </span>
                    </td>
                    <td>
                      <Stepper
                        value={qty}
                        min={1}
                        max={item.wine_vintage_id ? (stock ?? item.saved_quantity ?? qty) : 9999}
                        label="Quantité de {saleItemDescription(item)}"
                        onchange={(q) => setItemQuantity(index, q)}
                      />
                      {#if stock != null && qty >= stock}
                        <p class="t-caption t-warn stock-warn">Dernières bouteilles en stock</p>
                      {/if}
                    </td>
                    <td class="num">{formatEUR(toNumber(item.price))}</td>
                    <td class="num">
                      {#if toNumber(item.discount) > 0}
                        {item.discount_type === "percent" ? `−${toNumber(item.discount)} %` : `−${formatEUR(toNumber(item.discount))}`}
                      {:else}—{/if}
                    </td>
                    <td class="num"><strong>{formatEUR(lineTotal(item))}</strong></td>
                    <td class="col-actions">
                      <IconButton label="Retirer {saleItemDescription(item)}" onclick={() => removeSaleItem(index)}>
                        <IconTrash size={18} strokeWidth={1.75} />
                      </IconButton>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <div class="add-row">
          <div class="add-wine">
            <label class="t-label" for="sale-add-product">Ajouter un produit</label>
            <ProductVintageAutocomplete
              id="sale-add-product"
              bind:value={selectedVintageId}
              {wineVintages}
              tastingValue={TASTING_SELECT_VALUE}
              {getAvailableStock}
              {isVintageAlreadyAdded}
              formatLabel={getProductDisplayNameWithStock}
              onchange={handleVintageChange}
            />
          </div>
          <label class="add-qty">
            <span class="t-label">Qté</span>
            <input class="ui-control" type="number" min="1" inputmode="numeric" bind:value={selectedQuantity} placeholder="1" />
          </label>
          <label class="add-price">
            <span class="t-label">Prix unit.</span>
            <input class="ui-control num-input" type="number" step="0.01" min="0" inputmode="decimal" bind:value={selectedPrice} placeholder="0,00" />
          </label>
          <div class="add-discount">
            <span class="t-label">Remise</span>
            <AmountTypeInput bind:amount={selectedDiscount} bind:type={selectedDiscountType} ariaLabel="Remise sur la ligne" />
          </div>
          <div class="add-btn">
            <Button onclick={addSaleItem}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
          </div>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <Field id="sale-payment" label="Mode de paiement" help="Sinon, demandé au passage en « Payée ».">
        {#snippet children({ describedby })}
                <select id="sale-payment" class="ui-control" bind:value={formData.payment_method} aria-describedby={describedby}>
            <option value="">— Non renseigné —</option>
            {#each PAYMENT_METHOD_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
                      {/snippet}
            </Field>

      <Field id="sale-global-discount" label="Ristourne globale" optional help="Sur le sous-total, après les remises par article." >
        {#snippet children({ describedby })}
                <AmountTypeInput
            id="sale-global-discount"
            {describedby}
            bind:amount={formData.global_discount}
            bind:type={formData.global_discount_type}
            amountLabel="Montant TTC (€)"
            percentLabel="Pourcentage (%)"
          />
                      {/snippet}
            </Field>
    </div>

    <Field id="sale-tasting" label="Dégustation" optional help="Proposée automatiquement quand une dégustation a lieu à la date de la vente.">
      <select id="sale-tasting" class="ui-control" bind:value={formData.tasting_id} onchange={() => (tastingTouched = true)}>
        <option value="">— Aucune —</option>
        {#each tastings as t}
          <option value={t.id}>{t.name || "Dégustation"} · {formatDate(t.date)}</option>
        {/each}
      </select>
    </Field>

    <Field id="sale-note" label="Note">
      <textarea id="sale-note" class="ui-control" rows="2" placeholder="Visible uniquement par vous" bind:value={formData.note}></textarea>
    </Field>
  </form>

  {#snippet footer()}
      <div class="totals" aria-live="polite">
        <span>Sous-total <strong>{formatEUR(grossTotal)}</strong></span>
        <span>Remises <strong>{formatEUR(discountsTotal)}</strong></span>
        <span class="grand">Total TTC <strong>{formatEUR(total)}</strong></span>
      </div>
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" disabled={saving} onclick={submitForm}>Enregistrer la vente</Button>
  {/snippet}
</Modal>

<!-- Détail -->
<Modal open={showDetailsModal} title="Détail de la vente" maxWidth={720} onclose={closeDetailsModal}>
  {#snippet titleExtra()}
    {#if detailsSale}<StatusBadge status={detailsSale.status} />{/if}
  {/snippet}
  {#if detailsSale}
    <dl class="facts">
      <div><dt>Date</dt><dd>{formatDate(detailsSale.date)}</dd></div>
      <div>
        <dt>Client</dt>
        <dd>
          <a href="/manage/customers/{detailsSale.customer_id}">{customerName(detailsSale)}</a>{#if detailsSale.customer?.company_name}<span class="t-muted">&nbsp;· {detailsSale.customer.company_name}</span>{/if}
        </dd>
      </div>
      <div><dt>Facture</dt><dd>{detailsSale.invoice_number || "—"}</dd></div>
      <div><dt>Mode de paiement</dt><dd>{paymentMethodLabel(detailsSale.payment_method)}</dd></div>
      {#if detailsSale.tasting_id}
        <div><dt>Dégustation</dt><dd><a href="/manage/tastings/{detailsSale.tasting_id}/live">{tastingLabel(detailsSale.tasting_id)}</a></dd></div>
      {/if}
      {#if detailsSale.note}
        <div class="wide"><dt>Note</dt><dd>{detailsSale.note}</dd></div>
      {/if}
    </dl>

    {#if detailsSaleItems.length === 0}
      <EmptyState title="Aucun article" compact />
    {:else}
      <DataTable caption="Articles de la vente">
        <thead>
          <tr>
            <th scope="col">Article</th>
            <th scope="col" class="num">Qté</th>
            <th scope="col" class="num">Prix unit.</th>
            <th scope="col" class="num">Remise</th>
            <th scope="col" class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {#each detailsSaleItems as item}
            <tr>
              <td>{saleItemDescription(item)}</td>
              <td class="num">{item.quantity}</td>
              <td class="num">{formatEUR(toNumber(item.price))}</td>
              <td class="num">
                {#if toNumber(item.discount) > 0}
                  {item.discount_type === "percent" ? `−${toNumber(item.discount)} %` : `−${formatEUR(toNumber(item.discount))}`}
                {:else}—{/if}
              </td>
              <td class="num"><strong>{formatEUR(lineTotal(item))}</strong></td>
            </tr>
          {/each}
        </tbody>
      </DataTable>
      <div class="detail-totals">
        {#if toNumber(detailsSale.global_discount) > 0}
          <p><span>Sous-total articles (TTC)</span><span>{formatEUR(itemsSubtotal(detailsSaleItems))}</span></p>
          <p>
            <span>Ristourne globale {detailsSale.global_discount_type === "percent" ? `(${toNumber(detailsSale.global_discount)} %)` : "(montant)"}</span>
            <span>−{formatEUR(globalDiscountAmount(detailsSaleItems, detailsSale.total_price))}</span>
          </p>
        {/if}
        <p class="grand"><span>Total TTC</span><span>{formatEUR(detailsSale.total_price)}</span></p>
      </div>
    {/if}
  {/if}
  {#snippet footer()}
      {#if detailsSale?.status === "closed"}
        <Button onclick={() => downloadInvoice(detailsSale.id)}><IconDownload size={16} strokeWidth={1.75} /> Télécharger la facture</Button>
      {/if}
      {#if isEditable("sale", detailsSale?.status)}
        <Button
          onclick={() => {
            const s = detailsSale;
            closeDetailsModal();
            openEditModal(s);
          }}><IconPencil size={16} strokeWidth={1.75} /> Modifier</Button
        >
      {/if}
      <Button variant="primary" onclick={closeDetailsModal}>Fermer</Button>
  {/snippet}
</Modal>

<style>
  .toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search {
    position: relative;
    flex: 0 1 380px;
    display: flex;
    align-items: center;
    color: var(--ink-2);
  }

  .search :global(svg) {
    position: absolute;
    left: 12px;
  }

  .search input {
    padding-left: 36px;
  }

  .period {
    flex: 0 0 220px;
  }

  .empty-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .tasting-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: var(--r-pill);
    background: var(--mist);
    color: var(--teal-700);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .link-cell {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
  }

  .link-cell:hover {
    color: var(--teal-700);
    text-decoration: underline;
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .label-short {
    display: none;
  }

  .mobile-only {
    display: none;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: 8px;
  }

  .sale-card {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 4px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .sale-card-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 8px 12px 14px;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sc-top,
  .sc-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sc-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ——— Formulaire ——— */
  .will-be {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--r-pill);
    background: var(--st-pending-bg);
    color: var(--st-pending-fg);
    font-size: 12px;
    font-weight: 500;
  }

  .sale-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--control-h);
    padding: 0 4px 0 6px;
    border: 1px solid var(--input-border);
    border-radius: var(--r-sm);
    background: #fff;
  }

  .chip-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--mist);
    color: var(--teal-700);
    font-size: 11px;
    font-weight: 600;
  }

  .chip-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    margin: 0;
  }

  .items-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .items-head h3 {
    margin: 0;
  }

  .req {
    color: var(--danger);
  }

  .items-box {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: #fff;
    overflow: hidden;
  }

  .items-scroll {
    overflow-x: auto;
  }

  .items-table td {
    height: auto;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .wine-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .wine-name {
    display: flex;
    flex-direction: column;
  }

  .stock-warn {
    margin: 4px 0 0;
  }

  .add-row {
    display: grid;
    grid-template-columns: minmax(200px, 2.2fr) 72px 104px minmax(140px, 1.3fr) auto;
    gap: 10px;
    align-items: end;
    padding: 12px;
    background: var(--table-head);
    border-top: 1px solid var(--border-soft);
  }

  .add-row > * {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .num-input {
    text-align: right;
  }

  .totals {
    display: flex;
    align-items: baseline;
    gap: 20px;
    margin-right: auto;
    font-size: 13px;
    color: var(--ink-2);
  }

  .totals strong {
    color: var(--ink);
  }

  .totals .grand strong {
    font-family: var(--font-serif);
    font-size: 26px;
    font-weight: 600;
    margin-left: 4px;
  }

  /* ——— Détail ——— */
  .facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    margin: 0 0 20px;
  }

  .facts .wide {
    grid-column: 1 / -1;
  }

  .facts dt {
    font-size: 12px;
    color: var(--ink-2);
  }

  .facts dd {
    margin: 2px 0 0;
  }

  .detail-totals {
    margin-top: 12px;
  }

  .detail-totals p {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    color: var(--ink-2);
  }

  .detail-totals .grand {
    color: var(--ink);
    font-weight: 600;
    font-size: 16px;
  }

  @media (max-width: 767px) {
    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: flex;
    }

    .label-long {
      display: none;
    }

    .label-short {
      display: inline;
    }

    .toolbar {
      flex-direction: column;
    }

    .search,
    .period {
      flex: 1 1 auto;
    }

    .grid-2,
    .facts {
      grid-template-columns: 1fr;
    }

    .add-row {
      grid-template-columns: 1fr 1fr;
    }

    .add-wine,
    .add-discount,
    .add-btn {
      grid-column: 1 / -1;
    }

    .totals {
      width: 100%;
      flex-wrap: wrap;
      gap: 8px 16px;
    }
  }
</style>
