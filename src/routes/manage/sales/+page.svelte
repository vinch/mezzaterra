<script lang="ts">
  import { fetchAllRows, supabase } from "$lib/supabase";
  import { getContext, onMount } from "svelte";
  import type { PageData } from "./$types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import { EDITABLE_STATUSES, STATUS_META, type SaleStatus } from "$lib/status";
  import Menu, { type MenuItem } from "$lib/ui/Menu.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
  import AmountTypeInput from "$lib/ui/AmountTypeInput.svelte";
  import Stepper from "$lib/ui/Stepper.svelte";
  import WineDot, { robeOf, ROBE_LABEL } from "$lib/ui/WineDot.svelte";
  import {
    IconCheck,
    IconClock,
    IconDownload,
    IconEye,
    IconGlasses,
    IconLock,
    IconPencil,
    IconPlus,
    IconReceipt,
    IconSearch,
    IconTrash,
    IconTruck,
    IconX,
  } from "$lib/ui/icons";
  import { fold, formatDate, formatEUR, initials, toNumber } from "$lib/format";
  import { todayIso } from "$lib/dates";
  import { lineTotal } from "$lib/analytics";
  import { vintageProductLabel, vintageShortLabel } from "$lib/wine";
  import { fetchCustomers, fetchPickerVintages, fetchStockMap } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { invalidateAll } from "$app/navigation";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
  import CustomerAutocomplete from "$lib/components/manage/CustomerAutocomplete.svelte";

  export let data: PageData;

  const { refreshCounts } = getContext<{ refreshCounts: () => void }>("manage");

  /** Valeur interne du select « produit » pour une ligne dégustation (sans millésime). */
  const TASTING_SELECT_VALUE = "__tasting__";
  const TASTING_LINE_NOTE = "Dégustation";

  const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
    { value: "liquide", label: "Liquide" },
    { value: "virement", label: "Virement" },
    { value: "payconiq_pro", label: "Payconiq pro" },
    { value: "payconiq_perso", label: "Payconiq perso" },
  ];

  function paymentMethodLabel(value: string | null | undefined): string {
    if (value == null || String(value).trim() === "") return "—";
    const o = PAYMENT_METHOD_OPTIONS.find((p) => p.value === value);
    return o ? o.label : String(value);
  }

  let sales: any[];
  /* Rechargé par invalidateAll() après une création, une modification ou une suppression. */
  $: sales = data.sales;
  let customers: any[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  /** Modale unique création / édition (`editingSale` les distingue). */
  let formOpen = false;
  let saving = false;
  let showDetailsModal = false;
  let editingSale: any = null;
  let detailsSale: any = null;
  let detailsSaleItems: any[] = [];

  // Form fields
  let formData = {
    date: todayIso(),
    customer_id: "",
    status: "pending",
    note: "",
    global_discount: "",
    global_discount_type: "amount" as "amount" | "percent",
    payment_method: "",
    tasting_id: "",
  };

  // Sale items
  let saleItems: any[] = [];
  let selectedVintageId = "";
  let selectedQuantity = "";
  let selectedPrice = "";
  let selectedDiscount = "";
  /** Par défaut « montant » : sinon une remise saisie sans type était ignorée (discount_type null). */
  let selectedDiscountType: "amount" | "percent" = "amount";

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
      else await openCreateModal();
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

  function saleItemDescription(item: any): string {
    if (item.wine_vintage_id && item.wine_vintage) {
      return vintageProductLabel(item.wine_vintage);
    }
    const n = item.note != null ? String(item.note).trim() : "";
    return n || TASTING_LINE_NOTE;
  }

  function getProductDisplayNameWithStock(vintage: any, availableStock: number) {
    return `${vintageProductLabel(vintage)} - Stock : ${availableStock}`;
  }

  function getAvailableStock(vintageId: string): number {
    if (vintageId === TASTING_SELECT_VALUE) {
      return 999999;
    }
    const vintage = vintageById.get(vintageId);
    if (!vintage) return 0;

    const stock = vintage.stock || 0;
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
  $: stockUnknown = hasUnknownStock(wineVintages);

  /* Chargements des modales : le dernier clic gagne (deux « Modifier » enchaînés…). */
  const formLoad = latestOnly((e) => (error = errorMessage(e)));

  function showCreateForm() {
    editingSale = null;
    resetForm();
    formOpen = true;
  }

  async function openCreateModal() {
    /* Stock relu : des ventes ont pu être payées depuis l'ouverture de la page. */
    const vintages = await formLoad.run(fetchVintagesWithStock);
    if (!vintages) return;
    wineVintages = vintages;
    showCreateForm();
  }

  async function openEditModal(sale: any) {
    if (sale.status === "closed" || sale.status === "cancelled") {
      error = "Impossible de modifier une vente clôturée ou annulée";
      formLoad.cancel();
      return;
    }

    /* Stock relu : il a pu bouger depuis l'ouverture de la page. */
    const loaded = await formLoad.run(() => Promise.all([fetchVintagesWithStock(), loadSaleItems(sale.id)]));
    if (!loaded) return;
    const [vintages, items] = loaded;

    wineVintages = vintages;
    editingSale = sale;
    formData = {
      date: sale.date.split("T")[0],
      customer_id: sale.customer_id || "",
      status: sale.status || "pending",
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

  /** Lève une erreur : une édition ouverte sans ses lignes les effacerait à l'enregistrement. */
  async function loadSaleItems(saleId: string): Promise<any[]> {
    const { data, error: itemsError } = await supabase
      .from("sale_item")
      .select(
        `
        *,
        wine_vintage (
          *,
          wine (
            *,
            winery (*),
            appelation (*)
          )
        )
      `,
      )
      .eq("sale_id", saleId);

    if (itemsError) throw new Error(itemsError.message);
    return data || [];
  }

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

  async function generateAndSaveInvoiceNumber(
    saleId: string,
    saleDate: string,
  ): Promise<string | null> {
    // Year of the sale date (read from the string: a date-only value has no timezone)
    const year = Number(saleDate.slice(0, 4));
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // All sales of the year, by date then creation (paginated past PostgREST's 1000 rows):
    // their order gives the position, those already invoiced give the max number
    let allSalesInYear: { id: string; date: string; created_at: string; invoice_number: string | null }[];
    try {
      allSalesInYear = await fetchAllRows((from, to) =>
        supabase
          .from("sale")
          .select("id, date, created_at, invoice_number")
          .gte("date", yearStart)
          .lte("date", yearEnd)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
    } catch (err) {
      console.error(
        "Erreur lors de la génération du numéro de facture:",
        err,
      );
      return null;
    }

    // Find the position of this sale in the ordered list
    const saleIndex = allSalesInYear.findIndex((s) => s.id === saleId);

    // Find the highest invoice number for this year
    let maxInvoiceNumber = 0;
    for (const sale of allSalesInYear) {
      const match = sale.invoice_number?.match(/INV-\d+-(\d+)/);
      if (match) maxInvoiceNumber = Math.max(maxInvoiceNumber, parseInt(match[1], 10));
    }

    // Generate the next invoice number
    // Use the position in the year or max + 1, whichever is higher
    const sequenceNumber = Math.max(saleIndex + 1, maxInvoiceNumber + 1);

    const invoiceNumber = `INV-${year}-${String(sequenceNumber).padStart(3, "0")}`;

    // Save the invoice number to the database
    const { error: updateError } = await supabase
      .from("sale")
      .update({ invoice_number: invoiceNumber })
      .eq("id", saleId);

    if (updateError) {
      console.error(
        "Erreur lors de l'enregistrement du numéro de facture:",
        updateError,
      );
      return null;
    }

    return invoiceNumber;
  }

  async function downloadInvoice(saleId: string) {
    try {
      /* jsPDF n'est chargé qu'au moment de générer une facture. */
      const { default: jsPDF } = await import("jspdf");
      // Load sale with customer info
      const { data: sale, error: saleError } = await supabase
        .from("sale")
        .select(
          `
          *,
          customer (
            first_name,
            last_name,
            company_name,
            email,
            address_line_1,
            address_line_2,
            city,
            zip_code,
            country_id,
            vat
          )
        `,
        )
        .eq("id", saleId)
        .single();

      if (saleError || !sale) {
        error = `Erreur lors du chargement de la vente: ${saleError?.message}`;
        return;
      }

      // Load sale items with wine info
      const { data: items, error: itemsError } = await supabase
        .from("sale_item")
        .select(
          `
          *,
          wine_vintage (
            *,
            wine (
              *,
              winery (*),
              appelation (*)
            )
          )
        `,
        )
        .eq("sale_id", saleId);

      if (itemsError || !items) {
        error = `Erreur lors du chargement des articles: ${itemsError?.message}`;
        return;
      }

      // Use existing invoice number or generate one if it doesn't exist
      let invoiceNumber = sale.invoice_number;
      if (!invoiceNumber) {
        invoiceNumber = await generateAndSaveInvoiceNumber(sale.id, sale.date);
        if (!invoiceNumber) {
          error = "Impossible de générer le numéro de facture";
          return;
        }
      }

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("FACTURE", pageWidth - margin, yPos, { align: "right" });
      yPos += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`N° ${invoiceNumber}`, pageWidth - margin, yPos, {
        align: "right",
      });
      yPos += 6;
      doc.text(
        `Date: ${formatDate(sale.date)}`,
        pageWidth - margin,
        yPos,
        { align: "right" },
      );
      yPos += 15;

      // Company info (left side) and Customer info (right side)
      // Both start at the same Y position
      const customerX = pageWidth - margin;
      let customerY = yPos; // Start at same Y as company info

      // Company info (left side)
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Mezzaterra", margin, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      // You can add your company address here
      // doc.text("Adresse", margin, yPos);
      // yPos += 5;
      // doc.text("Code postal Ville", margin, yPos);
      // yPos += 5;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      let customerName = `${sale.customer.first_name} ${sale.customer.last_name}`;
      if (sale.customer.company_name) {
        customerName += `\n${sale.customer.company_name}`;
      }
      const customerLines = doc.splitTextToSize(customerName, 80);
      doc.text(customerLines, customerX, customerY, { align: "right" });
      // Calculate proper spacing: 5.5 per line for font size 12
      customerY += customerLines.length * 5.5 + 3;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (sale.customer.address_line_1) {
        doc.text(sale.customer.address_line_1, customerX, customerY, {
          align: "right",
        });
        customerY += 5;
      }
      if (sale.customer.address_line_2) {
        doc.text(sale.customer.address_line_2, customerX, customerY, {
          align: "right",
        });
        customerY += 5;
      }
      if (sale.customer.zip_code || sale.customer.city) {
        const cityLine =
          `${sale.customer.zip_code || ""} ${sale.customer.city || ""}`.trim();
        if (cityLine) {
          doc.text(cityLine, customerX, customerY, { align: "right" });
          customerY += 5;
        }
      }
      if (sale.customer.email) {
        doc.text(sale.customer.email, customerX, customerY, { align: "right" });
        customerY += 5;
      }
      if (sale.customer.vat) {
        doc.text(`TVA: ${sale.customer.vat}`, customerX, customerY, {
          align: "right",
        });
        customerY += 5;
      }

      // Use the maximum Y position between left and right columns
      yPos = Math.max(yPos, customerY);
      yPos += 15;

      // Check if customer is a company (has company_name or vat)
      const isCompany = !!(sale.customer.company_name || sale.customer.vat);
      const VAT_RATE = 0.21;

      // Items table header
      // Define column positions - optimize spacing to prevent overlaps
      // All numeric columns have the same width for consistency
      const descColStart = margin + 2;
      const numericColWidth = 18; // Fixed width for all numeric columns (Qté, PU HTVA, PU TTC, Total HTVA, Total TTC)
      const colSpacing = 2; // Spacing between columns

      // For companies: 6 columns (Description, Qté, PU HTVA, PU TTC, Total HTVA, Total TTC)
      // For individuals: 4 columns (Description, Qté, PU, Total)
      // Calculate positions from right to left
      const totalTTColX = pageWidth - margin - numericColWidth / 2; // Center of Total TTC column
      const totalHTColX = isCompany
        ? totalTTColX - numericColWidth - colSpacing
        : null; // Center of Total HTVA column (company only)
      const priceTTColX = isCompany
        ? (totalHTColX || totalTTColX) - numericColWidth - colSpacing
        : totalTTColX - numericColWidth - colSpacing; // Center of PU TTC column
      const priceHTColX = isCompany
        ? priceTTColX - numericColWidth - colSpacing
        : null; // Center of PU HTVA column (company only)
      const qtyColX = isCompany
        ? (priceHTColX || priceTTColX) - numericColWidth - colSpacing
        : priceTTColX - numericColWidth - colSpacing; // Center of Qté column

      // Calculate description width with padding
      const descColWidth = qtyColX - descColStart - numericColWidth / 2 - 15; // 15mm padding before Qté

      // Use smaller font size (9) for the entire table
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;
      doc.text("Description", descColStart, yPos);
      doc.text("Qté", qtyColX, yPos, { align: "center" });
      if (isCompany && priceHTColX !== null) {
        doc.text("PU HTVA", priceHTColX, yPos, { align: "center" });
      }
      doc.text(isCompany ? "PU TTC" : "PU", priceTTColX, yPos, {
        align: "center",
      });
      if (isCompany && totalHTColX !== null) {
        doc.text("Total HTVA", totalHTColX, yPos, { align: "center" });
      }
      doc.text(isCompany ? "Total TTC" : "Total", totalTTColX, yPos, {
        align: "center",
      });
      yPos += 3;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      // Items
      doc.setFont("helvetica", "normal");
      // Font size is already set to 9 for the entire table
      let subtotalTTC = 0;
      let subtotalHTVA = 0;

      for (const item of items) {
        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = margin + 20;
        }

        const productName = saleItemDescription(item);
        const quantity = item.quantity;
        const priceTTC = toNumber(item.price); // Price in DB is TTC
        const priceHTVA = isCompany ? priceTTC / (1 + VAT_RATE) : priceTTC;
        const itemTotalTTC = lineTotal(item);
        subtotalTTC += itemTotalTTC;

        // Calculate HTVA from TTC: HTVA = TTC / (1 + VAT_RATE)
        const itemTotalHTVA = isCompany
          ? itemTotalTTC / (1 + VAT_RATE)
          : itemTotalTTC;
        subtotalHTVA += itemTotalHTVA;

        // Description (with wrapping) - limit width to avoid overlap
        const descriptionLines = doc.splitTextToSize(productName, descColWidth);
        const startY = yPos;
        doc.text(descriptionLines, descColStart, startY);
        const itemHeight = Math.max(descriptionLines.length * 4.2, 6);

        // Quantity - centered in column
        doc.text(quantity.toString(), qtyColX, startY, { align: "center" });

        // Unit price HTVA if company - centered in column
        if (isCompany && priceHTColX !== null) {
          doc.text(`€${priceHTVA.toFixed(2)}`, priceHTColX, startY, {
            align: "center",
          });
        }

        // Unit price TTC - centered in column
        doc.text(`€${priceTTC.toFixed(2)}`, priceTTColX, startY, {
          align: "center",
        });

        // Total HTVA if company - centered in column
        if (isCompany && totalHTColX) {
          doc.text(`€${itemTotalHTVA.toFixed(2)}`, totalHTColX, startY, {
            align: "center",
          });
        }

        // Total TTC - centered in column
        doc.text(`€${itemTotalTTC.toFixed(2)}`, totalTTColX, startY, {
          align: "center",
        });

        yPos += itemHeight + 2;
      }

      const gDisc = toNumber(sale.global_discount);
      const gType = String(sale.global_discount_type ?? "")
        .trim()
        .toLowerCase();
      if (gDisc > 0 && (gType === "amount" || gType === "percent")) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Sous-total TTC: €${subtotalTTC.toFixed(2)}`,
          pageWidth - margin,
          yPos,
          { align: "right" },
        );
        yPos += 5;
        const ristEuro = Math.max(
          0,
          Math.round((subtotalTTC - toNumber(sale.total_price)) * 100) / 100,
        );
        const ristLabel =
          gType === "percent"
            ? `Ristourne globale (${gDisc} %) : –€${ristEuro.toFixed(2)}`
            : `Ristourne globale : –€${gDisc.toFixed(2)}`;
        doc.text(ristLabel, pageWidth - margin, yPos, { align: "right" });
        yPos += 8;
      }

      yPos += 5;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Totals
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");

      if (isCompany) {
        // Calculate final totals
        const totalHTVA = sale.total_price / (1 + VAT_RATE);
        const totalVAT = sale.total_price - totalHTVA;

        doc.text(
          `Total HTVA: €${totalHTVA.toFixed(2)}`,
          pageWidth - margin,
          yPos,
          { align: "right" },
        );
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          `TVA (21%): €${totalVAT.toFixed(2)}`,
          pageWidth - margin,
          yPos,
          { align: "right" },
        );
        yPos += 7;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Total TTC: €${sale.total_price.toFixed(2)}`,
          pageWidth - margin,
          yPos,
          { align: "right" },
        );
      } else {
        doc.text(
          `TOTAL: €${sale.total_price.toFixed(2)}`,
          pageWidth - margin,
          yPos,
          { align: "right" },
        );
      }

      if (sale.payment_method) {
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Mode de paiement : ${paymentMethodLabel(sale.payment_method)}`,
          margin,
          yPos,
        );
      }

      // Note if present
      if (sale.note) {
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setFont("helvetica", "italic");
        const noteLines = doc.splitTextToSize(
          `Note: ${sale.note}`,
          pageWidth - 2 * margin,
        );
        doc.text(noteLines, margin, yPos);
      }

      // Save PDF
      const fileName = `Facture_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      doc.save(fileName);
    } catch (err) {
      error = `Erreur lors de la génération de la facture: ${err}`;
      console.error(err);
    }
  }

  function resetForm() {
    formData = {
      date: todayIso(),
      customer_id: "",
      status: "pending",
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

  /** Sous-total TTC après remises par ligne (avant ristourne globale). */
  function itemsSubtotal(items: any[]): number {
    return Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) / 100;
  }

  /** Total TTC : sous-total moins la ristourne globale (montant ou %). */
  function saleTotal(items: any[], globalDiscount: unknown, globalDiscountType: string): number {
    const subtotal = itemsSubtotal(items);
    const g = toNumber(globalDiscount);
    if (g <= 0) return subtotal;
    if (globalDiscountType === "percent") {
      const pct = Math.min(100, g);
      return Math.max(0, Math.round(subtotal * (1 - pct / 100) * 100) / 100);
    }
    return Math.max(0, Math.round((subtotal - g) * 100) / 100);
  }

  $: total = saleTotal(saleItems, formData.global_discount, formData.global_discount_type);

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

    if (editingSale?.status === "closed" || editingSale?.status === "cancelled") {
      error = "Impossible de modifier une vente clôturée ou annulée";
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

    const saleData = {
      date: formData.date,
      customer_id: formData.customer_id,
      status: editingSale ? editingSale.status : "pending", // Keep the original status
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
      let saleId: string;
      if (editingSale) {
        saleId = editingSale.id;
        const { error: updateError } = await supabase
          .from("sale")
          .update(saleData)
          .eq("id", saleId);

        if (updateError) {
          error = updateError.message;
          return;
        }

        // Delete existing sale items
        const { error: deleteError } = await supabase
          .from("sale_item")
          .delete()
          .eq("sale_id", saleId);

        if (deleteError) {
          error = deleteError.message;
          return;
        }
      } else {
        const { data: newSale, error: insertError } = await supabase
          .from("sale")
          .insert(saleData)
          .select("id")
          .single();

        if (insertError) {
          error = insertError.message;
          return;
        }
        saleId = newSale.id;
      }

      const { error: itemError } = await supabase.from("sale_item").insert(
        saleItems.map((item) => ({
          sale_id: saleId,
          wine_vintage_id: item.wine_vintage_id ?? null,
          quantity: item.quantity,
          price: toNumber(item.price),
          discount: toNumber(item.discount) > 0 ? toNumber(item.discount) : null,
          discount_type: item.discount_type || null,
          note: item.note || null,
        })),
      );

      if (itemError) {
        error = itemError.message;
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

  async function updateSaleStatus(
    saleId: string,
    newStatus: string,
    currentStatus: string,
  ): Promise<boolean> {
    if (currentStatus === newStatus) {
      return true;
    }

    if (currentStatus === "cancelled") {
      error = "Impossible de modifier le statut d'une vente annulée.";
      return false;
    }

    if (currentStatus === "closed") {
      error = "Impossible de modifier le statut d'une vente clôturée.";
      return false;
    }

    if (
      newStatus === "pending" &&
      (currentStatus === "paid" ||
        currentStatus === "delivered" ||
        currentStatus === "closed")
    ) {
      error =
        "Impossible de repasser en « En attente » une fois la vente engagée (payée, livrée ou clôturée).";
      return false;
    }

    if (newStatus === "closed") {
      if (currentStatus !== "paid" && currentStatus !== "delivered") {
        error =
          "Une vente ne peut être clôturée qu’à partir des statuts « Payée » ou « Livrée ».";
        return false;
      }
      if (
        !confirm(
          "Clôturer cette vente ?\n\nElle ne pourra plus être modifiée ni changer de statut.",
        )
      ) {
        return false;
      }
    }

    if (newStatus === "delivered") {
      const stockHint =
        currentStatus === "pending"
          ? "\n\nLe stock sera débité (hors lignes dégustation)."
          : "";
      if (!confirm(`Marquer cette vente comme livrée ?${stockHint}`)) {
        return false;
      }
    }

    if (newStatus === "paid") {
      if (currentStatus !== "paid") {
        const { data: salePm, error: pmErr } = await supabase
          .from("sale")
          .select("payment_method")
          .eq("id", saleId)
          .single();
        if (pmErr || !String(salePm?.payment_method ?? "").trim()) {
          error =
            "Indiquez le mode de paiement (Modifier la vente) avant de marquer comme payée.";
          return false;
        }
      }
      const stockHint =
        currentStatus === "pending"
          ? "\n\nLe stock sera débité (hors lignes dégustation)."
          : "";
      if (
        !confirm(
          `Marquer cette vente comme payée ?${stockHint}\n\nUn numéro de facture sera attribué si besoin.`,
        )
      ) {
        return false;
      }
    }

    const { error: updateError } = await supabase
      .from("sale")
      .update({ status: newStatus })
      .eq("id", saleId);

    if (updateError) {
      error = updateError.message;
      return false;
    }

    /* Déstockage uniquement quand on quitte « En attente » vers Payée ou Livrée. */
    const shouldApplyStockOut =
      currentStatus === "pending" &&
      (newStatus === "paid" || newStatus === "delivered");

    if (shouldApplyStockOut) {
      const [{ data: sale, error: saleError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from("sale").select("customer ( first_name, last_name )").eq("id", saleId).single(),
        supabase.from("sale_item").select("wine_vintage_id, quantity").eq("sale_id", saleId),
      ]);

      if (saleError) {
        error = `Erreur lors du chargement de la vente: ${saleError.message}`;
        return false;
      }

      if (itemsError) {
        error = `Erreur lors du chargement des articles: ${itemsError.message}`;
        return false;
      }

      const customerName = sale.customer
        ? `${sale.customer.first_name} ${sale.customer.last_name}`
        : "Client inconnu";
      const note = `Vente à ${customerName}`;

      const moves = (items || [])
        .filter((item) => item.wine_vintage_id)
        .map((item) => ({
          wine_vintage_id: item.wine_vintage_id!,
          reason: "sale_out",
          quantity: -Math.abs(item.quantity),
          date: todayIso(),
          note: note,
        }));
      if (moves.length) {
        const { error: stockMoveError } = await supabase.from("stock_move").insert(moves);
        if (stockMoveError) {
          error = `Erreur lors de la création du mouvement de stock: ${stockMoveError.message}`;
          return false;
        }
      }
    }

    /* Numéro de facture attribué au passage en « Payée » ou à la clôture, s'il n'en a pas déjà un. */
    if ((newStatus === "paid" && currentStatus !== "paid") || newStatus === "closed") {
      const { data: saleForInv } = await supabase
        .from("sale")
        .select("id, date, invoice_number")
        .eq("id", saleId)
        .single();

      if (saleForInv && !saleForInv.invoice_number) {
        const invoiceNumber = await generateAndSaveInvoiceNumber(
          saleForInv.id,
          saleForInv.date,
        );
        if (!invoiceNumber) {
          console.error("Impossible de générer le numéro de facture");
        }
      }
    }

    // Update the local state
    const saleIndex = sales.findIndex((s) => s.id === saleId);
    if (saleIndex !== -1) {
      sales[saleIndex].status = newStatus;
      sales = [...sales];
    }

    return true;
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteSale(id: string) {
    const sale = sales.find((s) => s.id === id);
    if (sale && sale.status !== "pending") {
      error = "Seules les ventes en attente peuvent être supprimées.";
      return;
    }

    const { error: deleteError } = await supabase
      .from("sale")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    error = "";
    await invalidateAll();
    refreshCounts();
  }

  /* ——— Dégustations (lien vente ↔ dégustation) ——— */
  let tastings: { id: string; name: string | null; date: string }[] = [];
  async function loadTastings() {
    const { data } = await supabase.from("tasting").select("id, name, date").order("date", { ascending: false });
    tastings = data || [];
  }
  $: tastingById = new Map(tastings.map((t) => [t.id, t]));
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
  let tastingTouched = false;
  let lastDate = "";
  $: if (formOpen && !editingSale && formData.date !== lastDate) {
    lastDate = formData.date;
    if (!tastingTouched) formData.tasting_id = tastingOnDate(formData.date);
  }
  $: if (!formOpen) tastingTouched = false;
  let tastingFilter = "";

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
  let tab: Tab = "all";
  let search = "";
  let period = "all";

  $: years = [...new Set(sales.map((s) => String(s.date).slice(0, 4)))].sort().reverse();
  $: periodSales = sales
    .filter((s) => period === "all" || String(s.date).startsWith(period))
    .filter((s) => !tastingFilter || (tastingFilter === "none" ? !s.tasting_id : s.tasting_id === tastingFilter));
  $: counts = TABS.reduce(
    (acc, t) => ({ ...acc, [t.key]: t.key === "all" ? periodSales.length : periodSales.filter((s) => s.status === t.key).length }),
    {} as Record<Tab, number>,
  );
  $: visibleSales = periodSales
    .filter((s) => tab === "all" || s.status === tab)
    .filter((s) => {
      const q = fold(search.trim());
      if (!q) return true;
      const c = s.customer || {};
      return fold(`${c.first_name ?? ""} ${c.last_name ?? ""} ${c.company_name ?? ""} ${s.invoice_number ?? ""}`).includes(q);
    });
  $: pendingCount = sales.filter((s) => s.status === "pending").length;
  $: subtitle = `${periodSales.length} vente${periodSales.length > 1 ? "s" : ""}${period === "all" ? "" : ` en ${period}`} · ${pendingCount} en attente de paiement`;

  function customerName(s: any): string {
    return s?.customer ? `${s.customer.first_name} ${s.customer.last_name}`.trim() : "—";
  }

  /* Changement de statut depuis le badge (mêmes transitions que l'ancien sélecteur). */
  const STATUS_ACTIONS: Record<string, { label: string; icon: any }> = {
    paid: { label: "Marquer comme payée", icon: IconCheck },
    delivered: { label: "Marquer comme livrée", icon: IconTruck },
    closed: { label: "Clôturer et facturer", icon: IconLock },
  };
  function nextStatuses(cur: string): string[] {
    if (cur === "pending") return ["paid", "delivered"];
    if (cur === "paid") return ["delivered", "closed"];
    if (cur === "delivered") return ["paid", "closed"];
    return [];
  }
  async function changeStatus(sale: any, next: string) {
    error = "";
    const ok = await updateSaleStatus(sale.id, next, sale.status);
    if (ok) refreshCounts();
    else sales = [...sales];
  }

  let statusMenuSale: any = null;
  let statusMenuOpen = false;
  let statusAnchor: HTMLElement | null = null;
  const statusAnchors: Record<string, HTMLElement | null> = {};
  function openStatusMenu(sale: any) {
    statusMenuSale = sale;
    statusAnchor = statusAnchors[sale.id] ?? null;
    statusMenuOpen = true;
  }
  $: statusItems = statusMenuSale
    ? nextStatuses(statusMenuSale.status).map<MenuItem>((st) => ({
        label: STATUS_ACTIONS[st].label,
        icon: STATUS_ACTIONS[st].icon,
        onSelect: () => changeStatus(statusMenuSale, st),
      }))
    : [];

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
    items.push({ label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(sale) });
    for (const next of st === "pending" ? ["paid"] : st === "paid" ? ["delivered", "closed"] : ["closed"]) {
      items.push({ label: STATUS_ACTIONS[next].label, icon: STATUS_ACTIONS[next].icon, onSelect: () => changeStatus(sale, next) });
    }
    if (st === "pending") {
      items.push({ label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(sale) });
    }
    return items;
  }

  function openRow(sale: any, e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, [role=menu]")) return;
    openDetailsModal(sale);
  }

  let deleteTarget: any = null;
  let confirmOpen = false;
  let deleting = false;
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

  $: grossTotal = Math.round(
    saleItems.reduce((sum, it) => sum + toNumber(it.price) * (parseInt(String(it.quantity ?? 0), 10) || 0), 0) * 100,
  ) / 100;
  $: discountsTotal = Math.max(0, Math.round((grossTotal - total) * 100) / 100);
  $: bottleCount = saleItems.reduce((n, it) => n + (it.wine_vintage_id ? parseInt(String(it.quantity), 10) || 0 : 0), 0);

  $: vintageById = new Map(wineVintages.map((v) => [v.id, v]));
  function setItemQuantity(index: number, q: number) {
    saleItems = saleItems.map((it, i) => (i === index ? { ...it, quantity: q } : it));
  }

  /* Client choisi : puce + aide (goûts, dernier achat). */
  $: selectedCustomer = customers.find((c) => c.id === formData.customer_id) ?? null;
  let customerHint = "";
  let hintFor = "";
  $: if (formOpen && formData.customer_id && formData.customer_id !== hintFor) void loadCustomerHint(formData.customer_id);
  async function loadCustomerHint(id: string) {
    hintFor = id;
    customerHint = "";
    const own = sales.filter((s) => s.customer_id === id && s.status !== "cancelled");
    const last = own.map((s) => String(s.date)).sort().pop();
    const { data } = await supabase
      .from("sale_item")
      .select("quantity, sale_id, wine_vintage ( wine ( wine_type ( name ) ) )")
      .in("sale_id", own.map((s) => s.id).slice(0, 100));
    const byRobe = new Map<string, number>();
    for (const it of (data || []) as any[]) {
      const r = robeOf(it.wine_vintage?.wine?.wine_type);
      if (r !== "autre") byRobe.set(r, (byRobe.get(r) ?? 0) + (it.quantity || 0));
    }
    const fav = [...byRobe.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof ROBE_LABEL | undefined;
    if (hintFor !== id) return;
    customerHint = [
      fav ? `Aime les ${ROBE_LABEL[fav].toLowerCase()}s` : "",
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
</script>


<svelte:head>
  <title>Ventes - Gestion</title>
</svelte:head>

<ManagePageShell title="Ventes" {subtitle}>
  <svelte:fragment slot="actions">
    <Button variant="primary" on:click={openCreateModal}>
      <IconPlus size={18} strokeWidth={1.75} /> <span class="label-long">Nouvelle vente</span><span class="label-short">Nouvelle</span>
    </Button>
  </svelte:fragment>

  <svelte:fragment slot="tabs">
    <div class="tabs" role="tablist" aria-label="Filtrer par statut">
      {#each TABS as t}
        <button
          type="button"
          role="tab"
          class="tab"
          aria-selected={tab === t.key}
          on:click={() => (tab = t.key)}
        >
          {t.label}<span class="tab-count">{counts[t.key] ?? 0}</span>
        </button>
      {/each}
    </div>
  </svelte:fragment>

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
    <div class="loading">Chargement…</div>
  {:else if sales.length === 0}
    <div class="empty-card">
      <EmptyState icon={IconReceipt} title="Aucune vente pour l’instant" text="Créez la première vente : elle sera enregistrée « En attente ».">
        <Button on:click={openCreateModal}>Créer la première vente</Button>
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
            <tr class="is-clickable" on:click={(e) => openRow(sale, e)}>
              <td>{formatDate(sale.date)}</td>
              <td>
                <button type="button" class="link-cell" on:click={() => openDetailsModal(sale)}>{customerName(sale)}</button>
                {#if sale.customer?.company_name}<span class="t-muted">&nbsp;· {sale.customer.company_name}</span>{/if}
                {#if sale.tasting_id}<span class="tasting-tag" title={tastingLabel(sale.tasting_id)}><IconGlasses size={12} strokeWidth={1.75} aria-hidden="true" />{tastingById.get(sale.tasting_id)?.name || "Dégustation"}</span>{/if}
              </td>
              <td>
                {#if EDITABLE_STATUSES.includes(sale.status)}
                  <StatusBadge
                    status={sale.status}
                    interactive
                    bind:el={statusAnchors[sale.id]}
                    expanded={statusMenuOpen && statusMenuSale?.id === sale.id}
                    on:click={() => openStatusMenu(sale)}
                  />
                {:else}
                  <StatusBadge status={sale.status} />
                {/if}
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
                    <IconButton label="Télécharger la facture" on:click={() => downloadInvoice(sale.id)}>
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
          <button type="button" class="sale-card-main" on:click={() => openDetailsModal(sale)}>
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

<Menu bind:open={statusMenuOpen} anchor={statusAnchor} items={statusItems} label="Changer le statut" align="start" />

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer cette vente ?"
  busy={deleting}
  message={deleteTarget
    ? `La vente du ${formatDate(deleteTarget.date)} à ${customerName(deleteTarget)} (${formatEUR(deleteTarget.total_price)}) sera définitivement supprimée, avec ses articles. Le stock n’est pas modifié : une vente en attente ne l’a pas encore débité.`
    : ""}
  on:confirm={confirmDelete}
/>

<!-- Création / modification -->
<Modal open={formOpen} title={editingSale ? "Modifier la vente" : "Nouvelle vente"} maxWidth={820} on:close={closeForm}>
  <svelte:fragment slot="title-extra">
    {#if editingSale}
      <StatusBadge status={editingSale.status} />
    {:else}
      <span class="will-be"><IconClock size={14} strokeWidth={1.75} aria-hidden="true" /> Sera créée « En attente »</span>
    {/if}
  </svelte:fragment>

  <form id="sale-form" class="sale-form" on:submit|preventDefault={submitForm}>
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
            <IconButton label="Changer de client" on:click={clearCustomer}><IconX size={16} strokeWidth={1.75} /></IconButton>
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
          <EmptyState title="Aucun article ajouté" text="Cherchez un vin ci-dessous, puis « Ajouter »." compact />
        {:else}
          <div class="items-scroll">
            <table class="ui-table items-table">
              <thead>
                <tr>
                  <th scope="col">Vin</th>
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
                  <!-- Le stock ne borne que les ventes nouvelles ou en attente (pas encore sorties du stock). -->
                  {@const bounded = !!item.wine_vintage_id && (!editingSale || editingSale.status === "pending")}
                  <tr>
                    <td>
                      <span class="wine-cell">
                        {#if item.wine_vintage_id}
                          <WineDot robe={robeOf(v?.wine?.wine_type)} />
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
                        max={bounded ? (stock ?? item.saved_quantity ?? qty) : 9999}
                        label="Quantité de {saleItemDescription(item)}"
                        on:change={(e) => setItemQuantity(index, e.detail)}
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
                      <IconButton label="Retirer {saleItemDescription(item)}" on:click={() => removeSaleItem(index)}>
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
            <span class="t-label" id="add-wine-label">Ajouter un vin</span>
            {#key saleItems.map((i) => i.wine_vintage_id ?? "_tasting").join("|")}
              <ProductVintageAutocomplete
                bind:value={selectedVintageId}
                {wineVintages}
                tastingValue={TASTING_SELECT_VALUE}
                {getAvailableStock}
                {isVintageAlreadyAdded}
                formatLabel={getProductDisplayNameWithStock}
                on:change={handleVintageChange}
              />
            {/key}
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
            <Button on:click={addSaleItem}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
          </div>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <Field id="sale-payment" label="Mode de paiement" help="Obligatoire avant de passer la vente en « Payée »." let:describedby>
        <select id="sale-payment" class="ui-control" bind:value={formData.payment_method} aria-describedby={describedby}>
          <option value="">— Non renseigné —</option>
          {#each PAYMENT_METHOD_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </Field>

      <Field id="sale-global-discount" label="Ristourne globale" optional help="Sur le sous-total, après les remises par article." let:describedby>
        <AmountTypeInput
          id="sale-global-discount"
          {describedby}
          bind:amount={formData.global_discount}
          bind:type={formData.global_discount_type}
          amountLabel="Montant TTC (€)"
          percentLabel="Pourcentage (%)"
        />
      </Field>
    </div>

    <Field id="sale-tasting" label="Dégustation" optional help="Proposée automatiquement quand une dégustation a lieu à la date de la vente.">
      <select id="sale-tasting" class="ui-control" bind:value={formData.tasting_id} on:change={() => (tastingTouched = true)}>
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

  <svelte:fragment slot="footer">
    <div class="totals" aria-live="polite">
      <span>Sous-total <strong>{formatEUR(grossTotal)}</strong></span>
      <span>Remises <strong>{formatEUR(discountsTotal)}</strong></span>
      <span class="grand">Total TTC <strong>{formatEUR(total)}</strong></span>
    </div>
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" disabled={saving} on:click={submitForm}>Enregistrer la vente</Button>
  </svelte:fragment>
</Modal>

<!-- Détail -->
<Modal open={showDetailsModal} title="Détail de la vente" maxWidth={720} on:close={closeDetailsModal}>
  <svelte:fragment slot="title-extra">
    {#if detailsSale}<StatusBadge status={detailsSale.status} />{/if}
  </svelte:fragment>
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
            <span>−{formatEUR(Math.max(0, itemsSubtotal(detailsSaleItems) - toNumber(detailsSale.total_price)))}</span>
          </p>
        {/if}
        <p class="grand"><span>Total TTC</span><span>{formatEUR(detailsSale.total_price)}</span></p>
      </div>
    {/if}
  {/if}
  <svelte:fragment slot="footer">
    {#if detailsSale?.status === "closed"}
      <Button on:click={() => downloadInvoice(detailsSale.id)}><IconDownload size={16} strokeWidth={1.75} /> Télécharger la facture</Button>
    {/if}
    {#if detailsSale && EDITABLE_STATUSES.includes(detailsSale.status)}
      <Button
        on:click={() => {
          const s = detailsSale;
          closeDetailsModal();
          openEditModal(s);
        }}><IconPencil size={16} strokeWidth={1.75} /> Modifier</Button
      >
    {/if}
    <Button variant="primary" on:click={closeDetailsModal}>Fermer</Button>
  </svelte:fragment>
</Modal>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 12px;
    border: none;
    background: none;
    color: var(--ink-2);
    font: inherit;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }

  .tab[aria-selected="true"] {
    color: var(--ink);
    font-weight: 600;
  }

  .tab[aria-selected="true"]::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: -1px;
    height: 2px;
    background: var(--teal-600);
    border-radius: 2px;
  }

  .tab-count {
    min-width: 22px;
    padding: 1px 6px;
    border-radius: var(--r-pill);
    background: var(--table-head);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-2);
    text-align: center;
  }

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

    /* Onglets → puces défilant horizontalement. */
    .tabs {
      gap: 8px;
      padding: 12px 0;
    }

    .tab {
      height: 44px;
      padding: 0 14px;
      border: 1px solid var(--btn-border);
      border-radius: var(--r-pill);
      background: #fff;
      color: var(--ink);
    }

    .tab[aria-selected="true"] {
      background: var(--night);
      border-color: var(--night);
      color: #fff;
    }

    .tab[aria-selected="true"]::after {
      display: none;
    }

    .tab[aria-selected="true"] .tab-count {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
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
