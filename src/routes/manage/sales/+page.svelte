<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import Modal from "$lib/components/Modal.svelte";
  // @ts-ignore - jsPDF will be available after npm install
  import jsPDF from "jspdf";

  export let data: PageData;

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

  let sales: any[] = data.sales;
  let customers: any[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let showDetailsModal = false;
  let editingSale: any = null;
  let detailsSale: any = null;
  let detailsSaleItems: any[] = [];

  // Form fields
  let formData = {
    date: new Date().toISOString().split("T")[0],
    customer_id: "",
    status: "pending",
    total_price: 0,
    note: "",
    global_discount: "",
    global_discount_type: "amount" as "amount" | "percent",
    payment_method: "",
  };

  // Sale items
  let saleItems: any[] = [];
  let selectedVintageId = "";
  let selectedQuantity = "";
  let selectedPrice = "";
  let selectedDiscount = "";
  /** Par défaut « montant » : sinon une remise saisie sans type était ignorée (discount_type null). */
  let selectedDiscountType: "amount" | "percent" = "amount";

  /** Prix / remises : number ou string (numeric PostgREST), virgule décimale FR. */
  function toNumber(value: unknown): number {
    if (value == null || value === "") return 0;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const s = String(value).trim().replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  onMount(async () => {
    await loadCustomers();
    await loadWineVintages();
    loading = false;
  });

  function getProductDisplayName(vintage: any) {
    const winery = vintage.wine.winery.name;
    const wineName = vintage.wine.name;
    const appelation = vintage.wine.appelation?.name;

    if (wineName) {
      return `${winery} - ${wineName}`;
    } else if (appelation) {
      return `${winery} - ${appelation}`;
    } else {
      return winery;
    }
  }

  function getProductDisplayNameWithYear(vintage: any) {
    const baseName = getProductDisplayName(vintage);
    if (vintage.year) {
      return `${baseName} - ${vintage.year}`;
    } else {
      return `${baseName} (${vintage.production_year})`;
    }
  }

  function saleItemDescription(item: any): string {
    if (item.wine_vintage_id && item.wine_vintage) {
      return getProductDisplayNameWithYear(item.wine_vintage);
    }
    const n = item.note != null ? String(item.note).trim() : "";
    return n || TASTING_LINE_NOTE;
  }

  function sumDetailsItemsTTC(): number {
    let s = 0;
    for (const item of detailsSaleItems) {
      s += calculateItemTotal(item);
    }
    return Math.round(s * 100) / 100;
  }

  function getProductDisplayNameWithStock(
    vintage: any,
    availableStock: number,
  ) {
    const baseNameWithYear = getProductDisplayNameWithYear(vintage);
    return `${baseNameWithYear} - Stock : ${availableStock}`;
  }

  function getAvailableStock(vintageId: string): number {
    if (vintageId === TASTING_SELECT_VALUE) {
      return 999999;
    }
    const vintage = wineVintages.find((v) => v.id === vintageId);
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

  async function loadCustomers() {
    const { data } = await supabase
      .from("customer")
      .select("*")
      .order("last_name");
    if (data) customers = data;
  }

  async function loadWineVintages() {
    const { data } = await supabase
      .from("wine_vintage")
      .select(
        `
        *,
        wine (
          *,
          winery (*),
          appelation (*)
        )
      `,
      )
      .order("production_year", { ascending: false });
    if (data) {
      // Load stock for each vintage
      const vintagesWithStock = await Promise.all(
        data.map(async (vintage) => {
          const { data: inventory } = await supabase
            .from("inventory")
            .select("quantity_on_hand")
            .eq("wine_vintage_id", vintage.id)
            .maybeSingle();

          return {
            ...vintage,
            stock: inventory?.quantity_on_hand || 0,
          };
        }),
      );

      wineVintages = vintagesWithStock;
      // Sort by winery, then wine name/appellation, then year
      wineVintages.sort((a, b) => {
        // First: sort by winery name
        const wineryA = a.wine.winery.name.toLowerCase();
        const wineryB = b.wine.winery.name.toLowerCase();
        if (wineryA !== wineryB) {
          return wineryA.localeCompare(wineryB);
        }

        // Second: sort by wine name or appellation
        const wineNameA =
          a.wine.name?.toLowerCase() ||
          a.wine.appelation?.name?.toLowerCase() ||
          "";
        const wineNameB =
          b.wine.name?.toLowerCase() ||
          b.wine.appelation?.name?.toLowerCase() ||
          "";
        if (wineNameA !== wineNameB) {
          return wineNameA.localeCompare(wineNameB);
        }

        // Third: sort by year (year if exists, else production_year)
        const yearA = a.year || a.production_year;
        const yearB = b.year || b.production_year;
        return yearB - yearA; // Descending order (newest first)
      });
    }
  }

  function openCreateModal() {
    editingSale = null;
    resetForm();
    saleItems = [];
    showModal = true;
  }

  async function openEditModal(sale: any) {
    if (sale.status === "closed" || sale.status === "cancelled") {
      error = "Impossible de modifier une vente clôturée ou annulée";
      return;
    }

    editingSale = sale;
    formData = {
      date: sale.date.split("T")[0],
      customer_id: sale.customer_id || "",
      status: sale.status || "pending",
      total_price: sale.total_price || 0,
      note: sale.note || "",
      global_discount:
        sale.global_discount != null && toNumber(sale.global_discount) > 0
          ? String(sale.global_discount)
          : "",
      global_discount_type:
        sale.global_discount_type === "percent" ? "percent" : "amount",
      payment_method: sale.payment_method ?? "",
    };
    await loadWineVintages(); // Reload vintages with stock
    await loadSaleItems(sale.id);
    // Update saleItems format to match what the form expects and load stock
    saleItems = await Promise.all(
      saleItems.map(async (item: any) => {
        if (!item.wine_vintage_id) {
          return {
            wine_vintage: null,
            wine_vintage_id: null,
            quantity: item.quantity,
            price: toNumber(item.price),
            discount: toNumber(item.discount),
            discount_type: item.discount_type || null,
            note: item.note || TASTING_LINE_NOTE,
          };
        }

        const { data: inventory } = await supabase
          .from("inventory")
          .select("quantity_on_hand")
          .eq("wine_vintage_id", item.wine_vintage_id)
          .maybeSingle();

        return {
          wine_vintage: {
            ...item.wine_vintage,
            stock: inventory?.quantity_on_hand || 0,
          },
          wine_vintage_id: item.wine_vintage_id,
          quantity: item.quantity,
          price: toNumber(item.price),
          discount: toNumber(item.discount),
          discount_type: item.discount_type || null,
          note: item.note || "",
        };
      }),
    );
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
    selectedDiscount = "";
    selectedDiscountType = "amount";
    showEditModal = true;
  }

  async function loadSaleItems(saleId: string) {
    const { data } = await supabase
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

    saleItems = data || [];
  }

  function closeModal() {
    showModal = false;
    editingSale = null;
    resetForm();
    saleItems = [];
  }

  function closeEditModal() {
    showEditModal = false;
    editingSale = null;
    resetForm();
    saleItems = [];
  }

  async function openDetailsModal(sale: any) {
    detailsSale = sale;
    await loadSaleItems(sale.id);
    detailsSaleItems = saleItems;
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
    // Extract year from sale date
    const year = new Date(saleDate).getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Get all sales in the same year that already have an invoice_number
    const { data: salesInYear, error } = await supabase
      .from("sale")
      .select("id, date, created_at, invoice_number")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .not("invoice_number", "is", null)
      .order("date", { ascending: true });

    if (error) {
      console.error(
        "Erreur lors de la génération du numéro de facture:",
        error,
      );
      return null;
    }

    // Get all sales in the year (including those without invoice_number) for sorting
    const { data: allSalesInYear } = await supabase
      .from("sale")
      .select("id, date, created_at, invoice_number")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .order("date", { ascending: true });

    if (!allSalesInYear) {
      return null;
    }

    // Sort by date, then by created_at for sales with same date
    allSalesInYear.sort((a, b) => {
      const dateCompare =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Find the position of this sale in the ordered list
    const saleIndex = allSalesInYear.findIndex((s) => s.id === saleId);

    // Find the highest invoice number for this year
    let maxInvoiceNumber = 0;
    if (salesInYear && salesInYear.length > 0) {
      for (const sale of salesInYear) {
        if (sale.invoice_number) {
          const match = sale.invoice_number.match(/INV-\d+-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxInvoiceNumber) {
              maxInvoiceNumber = num;
            }
          }
        }
      }
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
    // @ts-ignore - jsPDF types will be available after npm install
    try {
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
        `Date: ${new Date(sale.date).toLocaleDateString("fr-FR")}`,
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
        const itemTotalTTC = calculateItemTotal(item);
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
        // @ts-ignore - jsPDF types will be available after npm install
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
      date: new Date().toISOString().split("T")[0],
      customer_id: "",
      status: "pending",
      total_price: 0,
      note: "",
      global_discount: "",
      global_discount_type: "amount",
      payment_method: "",
    };
    saleItems = [];
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
    selectedDiscount = "";
    selectedDiscountType = "amount";
  }

  function calculateItemTotal(item: any) {
    const price = toNumber(item.price);
    const quantity = parseInt(String(item.quantity ?? 0), 10) || 0;
    const discount = toNumber(item.discount);
    const discountKind = String(item.discount_type ?? "")
      .trim()
      .toLowerCase();

    let itemTotal = price * quantity;

    if (discount > 0) {
      if (discountKind === "percent") {
        itemTotal = itemTotal * (1 - discount / 100);
      } else if (discountKind === "amount") {
        itemTotal = itemTotal - discount;
      }
    }

    return Math.round(itemTotal * 100) / 100;
  }

  /** Sous-total TTC après remises par ligne (avant ristourne globale). */
  function calculateSubtotal() {
    let total = 0;
    for (const item of saleItems) {
      total += calculateItemTotal(item);
    }
    return Math.round(total * 100) / 100;
  }

  function calculateTotal() {
    const subtotal = calculateSubtotal();
    const g = toNumber(formData.global_discount);
    if (g <= 0) return subtotal;

    const typ = formData.global_discount_type;
    if (typ === "percent") {
      const pct = Math.min(100, g);
      return Math.max(0, Math.round(subtotal * (1 - pct / 100) * 100) / 100);
    }
    return Math.max(0, Math.round((subtotal - g) * 100) / 100);
  }

  /* Dépendances explicites : Svelte 5 ne suit pas saleItems via calculateTotal() → calculateSubtotal(). */
  $: {
    const _items = saleItems;
    const _g = formData.global_discount;
    const _gt = formData.global_discount_type;
    void _items;
    void _g;
    void _gt;
    formData.total_price = calculateTotal();
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

  async function handleSubmit() {
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

    const calculatedTotal = calculateTotal();
    const saleData = {
      date: formData.date,
      customer_id: formData.customer_id,
      status: "pending",
      total_price: calculatedTotal,
      note: formData.note || null,
      global_discount: gGlobal > 0 ? gGlobal : null,
      global_discount_type: gGlobal > 0 ? formData.global_discount_type : null,
      payment_method: formData.payment_method?.trim()
        ? formData.payment_method.trim()
        : null,
    };

    const { data: newSale, error: insertError } = await supabase
      .from("sale")
      .insert(saleData)
      .select()
      .single();

    if (insertError) {
      error = insertError.message;
      return;
    }

    // Insert sale items
    for (const item of saleItems) {
      const { error: itemError } = await supabase.from("sale_item").insert({
        sale_id: newSale.id,
        wine_vintage_id: item.wine_vintage_id ?? null,
        quantity: item.quantity,
        price: toNumber(item.price),
        discount: toNumber(item.discount) > 0 ? toNumber(item.discount) : null,
        discount_type: item.discount_type || null,
        note: item.note || null,
      });

      if (itemError) {
        error = itemError.message;
        return;
      }
    }

    closeModal();
    window.location.reload();
  }

  async function handleUpdate() {
    if (!formData.customer_id || saleItems.length === 0) {
      error = "Le client et au moins un article sont obligatoires";
      return;
    }

    if (!editingSale) return;

    if (editingSale.status === "closed" || editingSale.status === "cancelled") {
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

    const calculatedTotal = calculateTotal();
    const saleData = {
      date: formData.date,
      customer_id: formData.customer_id,
      status: editingSale.status, // Keep the original status
      total_price: calculatedTotal,
      note: formData.note || null,
      global_discount: gGlobal > 0 ? gGlobal : null,
      global_discount_type: gGlobal > 0 ? formData.global_discount_type : null,
      payment_method: formData.payment_method?.trim()
        ? formData.payment_method.trim()
        : null,
    };

    const { error: updateError } = await supabase
      .from("sale")
      .update(saleData)
      .eq("id", editingSale.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    // Delete existing sale items
    const { error: deleteError } = await supabase
      .from("sale_item")
      .delete()
      .eq("sale_id", editingSale.id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    // Insert updated sale items
    for (const item of saleItems) {
      const { error: itemError } = await supabase.from("sale_item").insert({
        sale_id: editingSale.id,
        wine_vintage_id: item.wine_vintage_id ?? null,
        quantity: item.quantity,
        price: toNumber(item.price),
        discount: toNumber(item.discount) > 0 ? toNumber(item.discount) : null,
        discount_type: item.discount_type || null,
        note: item.note || null,
      });

      if (itemError) {
        error = itemError.message;
        return;
      }
    }

    closeEditModal();
    window.location.reload();
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
      const { data: sale, error: saleError } = await supabase
        .from("sale")
        .select(
          `
          *,
          customer (
            first_name,
            last_name
          )
        `,
        )
        .eq("id", saleId)
        .single();

      if (saleError) {
        error = `Erreur lors du chargement de la vente: ${saleError.message}`;
        return false;
      }

      const { data: items, error: itemsError } = await supabase
        .from("sale_item")
        .select("*")
        .eq("sale_id", saleId);

      if (itemsError) {
        error = `Erreur lors du chargement des articles: ${itemsError.message}`;
        return false;
      }

      const customerName = sale.customer
        ? `${sale.customer.first_name} ${sale.customer.last_name}`
        : "Client inconnu";
      const note = `Vente à ${customerName}`;

      for (const item of items || []) {
        if (!item.wine_vintage_id) continue;
        const { error: stockMoveError } = await supabase
          .from("stock_move")
          .insert({
            wine_vintage_id: item.wine_vintage_id,
            reason: "sale_out",
            quantity: -Math.abs(item.quantity),
            date: new Date().toISOString().split("T")[0],
            note: note,
          });

        if (stockMoveError) {
          error = `Erreur lors de la création du mouvement de stock: ${stockMoveError.message}`;
          return false;
        }
      }
    }

    if (newStatus === "paid" && currentStatus !== "paid") {
      const { data: saleForInv } = await supabase
        .from("sale")
        .select("id, date")
        .eq("id", saleId)
        .single();

      if (saleForInv) {
        const invoiceNumber = await generateAndSaveInvoiceNumber(
          saleForInv.id,
          saleForInv.date,
        );
        if (!invoiceNumber) {
          console.error("Impossible de générer le numéro de facture");
        }
      }
    }

    if (newStatus === "closed") {
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

  async function deleteSale(id: string) {
    const sale = sales.find((s) => s.id === id);
    if (sale && sale.status !== "pending") {
      error = "Seules les ventes en attente peuvent être supprimées.";
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette vente ?")) {
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

    window.location.reload();
  }
</script>

<svelte:head>
  <title>Ventes - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Ventes</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouvelle vente</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if sales.length === 0}
      <div class="empty-state">
        <p>Aucune vente trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première vente
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Montant total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each sales as sale}
              <tr>
                <td>{new Date(sale.date).toLocaleDateString("fr-FR")}</td>
                <td>
                  <strong>
                    {sale.customer.first_name}
                    {sale.customer.last_name}
                    {#if sale.customer.company_name}
                      ({sale.customer.company_name})
                    {/if}
                  </strong>
                </td>
                <td>
                  {#if sale.status === "cancelled"}
                    <span class="status-badge status-cancelled">Annulée</span>
                  {:else if sale.status === "closed"}
                    <span class="status-badge status-closed">Clôturée</span>
                  {:else}
                    <select
                      class="status-select status-{sale.status}"
                      value={sale.status}
                      on:change={async (e) => {
                        const target = e.target as HTMLSelectElement;
                        const previousStatus = sale.status;
                        const newStatus = target.value;

                        const success = await updateSaleStatus(
                          sale.id,
                          newStatus,
                          previousStatus,
                        );

                        if (!success) {
                          target.value = previousStatus;
                          await new Promise((resolve) =>
                            setTimeout(resolve, 0),
                          );
                          sales = [...sales];
                        }
                      }}
                    >
                      <option
                        value="pending"
                        disabled={sale.status !== "pending"}>En attente</option
                      >
                      <option value="delivered">Livrée</option>
                      <option value="paid">Payée</option>
                      <option
                        value="closed"
                        disabled={sale.status === "pending"}>Clôturée</option
                      >
                    </select>
                  {/if}
                </td>
                <td><strong>€{sale.total_price.toFixed(2)}</strong></td>
                <td>
                  <div class="actions">
                    {#if sale.status === "pending"}
                      <button
                        class="btn-edit"
                        on:click={() => openEditModal(sale)}
                      >
                        Modifier
                      </button>
                      <button
                        class="btn-delete"
                        on:click={() => deleteSale(sale.id)}
                      >
                        Supprimer
                      </button>
                    {:else if sale.status === "paid" || sale.status === "delivered"}
                      <button
                        class="btn-edit"
                        on:click={() => openEditModal(sale)}
                      >
                        Modifier
                      </button>
                    {:else if sale.status === "closed"}
                      <button
                        class="btn-details"
                        on:click={() => openDetailsModal(sale)}
                      >
                        Détails
                      </button>
                      <button
                        class="btn-download"
                        on:click={() => downloadInvoice(sale.id)}
                      >
                        Télécharger facture
                      </button>
                    {:else if sale.status === "cancelled"}
                      <button
                        class="btn-details"
                        on:click={() => openDetailsModal(sale)}
                      >
                        Détails
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modal de création -->
<Modal
  show={showModal}
  title="Nouvelle vente"
  modalId="modal-title-create"
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="date">Date *</label>
        <input type="date" id="date" bind:value={formData.date} required />
      </div>

      <div class="form-group">
        <label for="customer_id">Client *</label>
        <select id="customer_id" bind:value={formData.customer_id} required>
          <option value="">Sélectionner un client</option>
          {#each customers as customer}
            <option value={customer.id}>
              {customer.first_name}
              {customer.last_name}
            </option>
          {/each}
        </select>
      </div>

      <div class="form-group full-width">
        <label for="payment-method-create">Mode de paiement</label>
        <select id="payment-method-create" bind:value={formData.payment_method}>
          <option value="">— Non renseigné —</option>
          {#each PAYMENT_METHOD_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <p class="field-hint">
          Obligatoire avant de passer la vente en « Payée ».
        </p>
      </div>

      <div class="form-group full-width">
        <label for="note">Note</label>
        <textarea id="note" bind:value={formData.note} rows="2"></textarea>
      </div>

      <div class="form-group full-width">
        <label for="global-discount-create">Ristourne globale (optionnel)</label
        >
        <div class="global-discount-row">
          <input
            id="global-discount-create"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            bind:value={formData.global_discount}
          />
          <select
            id="global-discount-type-create"
            bind:value={formData.global_discount_type}
            aria-label="Type de ristourne globale"
          >
            <option value="amount">Montant TTC (€)</option>
            <option value="percent">Pourcentage (%)</option>
          </select>
        </div>
        <p class="field-hint">
          Sur le sous-total des lignes, après remises par article.
        </p>
      </div>

      <div class="form-group full-width">
        <div class="section-title">Articles *</div>
        <div class="sale-items-container">
          {#if saleItems.length === 0}
            <p class="empty-text">Aucun article ajouté</p>
          {:else}
            <div class="sale-items-list">
              {#each saleItems as item, index}
                <div class="sale-item">
                  <span>
                    {saleItemDescription(item)} — x{item.quantity}
                    @ €{toNumber(item.price).toFixed(2)}
                    {#if toNumber(item.discount) > 0}
                      {#if item.discount_type === "percent"}
                        (-{toNumber(item.discount)}%)
                      {:else if item.discount_type === "amount"}
                        (-€{toNumber(item.discount).toFixed(2)})
                      {/if}
                    {/if}
                    = €{calculateItemTotal(item).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    class="btn-remove"
                    on:click={() => removeSaleItem(index)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div class="add-item-form">
            <div class="add-item-row">
              {#key saleItems
                .map((i) => i.wine_vintage_id ?? "_tasting")
                .join("|")}
                <select
                  bind:value={selectedVintageId}
                  on:change={handleVintageChange}
                >
                  <option value="">Sélectionner un produit</option>
                  <option value={TASTING_SELECT_VALUE}>Dégustation</option>
                  {#each wineVintages as vintage}
                    {@const availableStock = getAvailableStock(vintage.id)}
                    {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                    <option
                      value={vintage.id}
                      disabled={availableStock === 0 || alreadyAdded}
                    >
                      {getProductDisplayNameWithStock(vintage, availableStock)}
                    </option>
                  {/each}
                </select>
              {/key}
              <input
                type="number"
                min="1"
                placeholder="Qté"
                bind:value={selectedQuantity}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Prix"
                bind:value={selectedPrice}
              />
            </div>
            <div class="add-item-row">
              <label for="discount-create-row">Remise</label>
              <input
                type="number"
                id="discount-create-row"
                step="0.01"
                min="0"
                placeholder="Montant"
                bind:value={selectedDiscount}
              />
              <select bind:value={selectedDiscountType}>
                <option value="amount">Montant (€)</option>
                <option value="percent">Pourcentage (%)</option>
              </select>
            </div>
            <div class="add-item-row">
              <button type="button" class="btn-add" on:click={addSaleItem}>
                Ajouter
              </button>
            </div>
          </div>
          <div class="total-display">
            {#if toNumber(formData.global_discount) > 0}
              <div class="total-display-sub">
                Sous-total : €{calculateSubtotal().toFixed(2)}
              </div>
            {/if}
            <strong>Total: €{formData.total_price.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">Créer la vente</button>
    </div>
  </form>
</Modal>

<!-- Modal d'édition -->
<Modal
  show={showEditModal}
  title="Modifier la vente"
  modalId="modal-title-edit"
  on:close={closeEditModal}
>
  <form on:submit|preventDefault={handleUpdate}>
    <div class="form-grid">
      <div class="form-group">
        <label for="edit-date">Date *</label>
        <input type="date" id="edit-date" bind:value={formData.date} required />
      </div>

      <div class="form-group">
        <label for="edit-customer_id">Client *</label>
        <select
          id="edit-customer_id"
          bind:value={formData.customer_id}
          required
        >
          <option value="">Sélectionner un client</option>
          {#each customers as customer}
            <option value={customer.id}>
              {customer.first_name}
              {customer.last_name}
            </option>
          {/each}
        </select>
      </div>

      <div class="form-group full-width">
        <label for="payment-method-edit">Mode de paiement</label>
        <select id="payment-method-edit" bind:value={formData.payment_method}>
          <option value="">— Non renseigné —</option>
          {#each PAYMENT_METHOD_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <p class="field-hint">
          Obligatoire avant de passer la vente en « Payée ».
        </p>
      </div>

      <div class="form-group full-width">
        <label for="edit-note">Note</label>
        <textarea id="edit-note" bind:value={formData.note} rows="2"></textarea>
      </div>

      <div class="form-group full-width">
        <label for="global-discount-edit">Ristourne globale (optionnel)</label>
        <div class="global-discount-row">
          <input
            id="global-discount-edit"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            bind:value={formData.global_discount}
          />
          <select
            id="global-discount-type-edit"
            bind:value={formData.global_discount_type}
            aria-label="Type de ristourne globale"
          >
            <option value="amount">Montant TTC (€)</option>
            <option value="percent">Pourcentage (%)</option>
          </select>
        </div>
        <p class="field-hint">
          Sur le sous-total des lignes, après remises par article.
        </p>
      </div>

      <div class="form-group full-width">
        <div class="section-title">Articles *</div>
        <div class="sale-items-container">
          {#if saleItems.length === 0}
            <p class="empty-text">Aucun article ajouté</p>
          {:else}
            <div class="sale-items-list">
              {#each saleItems as item, index}
                <div class="sale-item">
                  <span>
                    {saleItemDescription(item)} — x{item.quantity}
                    @ €{toNumber(item.price).toFixed(2)}
                    {#if toNumber(item.discount) > 0}
                      {#if item.discount_type === "percent"}
                        (-{toNumber(item.discount)}%)
                      {:else if item.discount_type === "amount"}
                        (-€{toNumber(item.discount).toFixed(2)})
                      {/if}
                    {/if}
                    = €{calculateItemTotal(item).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    class="btn-remove"
                    on:click={() => removeSaleItem(index)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div class="add-item-form">
            <div class="add-item-row">
              {#key saleItems
                .map((i) => i.wine_vintage_id ?? "_tasting")
                .join("|")}
                <select
                  bind:value={selectedVintageId}
                  on:change={handleVintageChange}
                >
                  <option value="">Sélectionner un produit</option>
                  <option value={TASTING_SELECT_VALUE}>Dégustation</option>
                  {#each wineVintages as vintage}
                    {@const availableStock = getAvailableStock(vintage.id)}
                    {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                    <option
                      value={vintage.id}
                      disabled={availableStock === 0 || alreadyAdded}
                    >
                      {getProductDisplayNameWithStock(vintage, availableStock)}
                    </option>
                  {/each}
                </select>
              {/key}
              <input
                type="number"
                min="1"
                placeholder="Qté"
                bind:value={selectedQuantity}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Prix"
                bind:value={selectedPrice}
              />
            </div>
            <div class="add-item-row">
              <label for="discount-edit-row">Remise</label>
              <input
                type="number"
                id="discount-edit-row"
                step="0.01"
                min="0"
                placeholder="Montant"
                bind:value={selectedDiscount}
              />
              <select bind:value={selectedDiscountType}>
                <option value="amount">Montant (€)</option>
                <option value="percent">Pourcentage (%)</option>
              </select>
            </div>
            <div class="add-item-row">
              <button type="button" class="btn-add" on:click={addSaleItem}>
                Ajouter
              </button>
            </div>
          </div>
          <div class="total-display">
            {#if toNumber(formData.global_discount) > 0}
              <div class="total-display-sub">
                Sous-total : €{calculateSubtotal().toFixed(2)}
              </div>
            {/if}
            <strong>Total: €{formData.total_price.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeEditModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">Enregistrer</button>
    </div>
  </form>
</Modal>

<!-- Modal de détails -->
<Modal
  show={showDetailsModal}
  title="Détails de la vente"
  modalId="modal-title-details"
  on:close={closeDetailsModal}
>
  {#if detailsSale}
    <div class="details-content">
      <div class="details-grid">
        <div class="details-group">
          <label>Date</label>
          <div>{new Date(detailsSale.date).toLocaleDateString("fr-FR")}</div>
        </div>

        <div class="details-group">
          <label>Client</label>
          <div>
            <strong>
              {detailsSale.customer.first_name}
              {detailsSale.customer.last_name}
              {#if detailsSale.customer.company_name}
                ({detailsSale.customer.company_name})
              {/if}
            </strong>
          </div>
        </div>

        <div class="details-group">
          <label>Statut</label>
          <div>
            <span class="status-badge status-{detailsSale.status}">
              {detailsSale.status === "pending"
                ? "En attente"
                : detailsSale.status === "paid"
                  ? "Payée"
                  : detailsSale.status === "delivered"
                    ? "Livrée"
                    : detailsSale.status === "closed"
                      ? "Clôturée"
                      : detailsSale.status === "cancelled"
                        ? "Annulée"
                        : detailsSale.status}
            </span>
          </div>
        </div>

        <div class="details-group">
          <label>Mode de paiement</label>
          <div>{paymentMethodLabel(detailsSale.payment_method)}</div>
        </div>

        {#if detailsSale.note}
          <div class="details-group full-width">
            <label>Note</label>
            <div>{detailsSale.note}</div>
          </div>
        {/if}
      </div>

      <div class="details-section">
        <h3>Articles</h3>
        {#if detailsSaleItems.length === 0}
          <p class="empty-text">Aucun article</p>
        {:else}
          <div class="details-items-list">
            {#each detailsSaleItems as item}
              <div class="details-item">
                <div class="details-item-name">
                  {saleItemDescription(item)}
                </div>
                <div class="details-item-details">
                  <span>x{item.quantity}</span>
                  <span>@ €{toNumber(item.price).toFixed(2)}</span>
                  {#if toNumber(item.discount) > 0}
                    <span>
                      {#if item.discount_type === "percent"}
                        (-{toNumber(item.discount)}%)
                      {:else if item.discount_type === "amount"}
                        (-€{toNumber(item.discount).toFixed(2)})
                      {/if}
                    </span>
                  {/if}
                  <strong>= €{calculateItemTotal(item).toFixed(2)}</strong>
                </div>
              </div>
            {/each}
          </div>
          {#if toNumber(detailsSale.global_discount) > 0}
            <div class="details-summary-line">
              <span>Sous-total articles (TTC)</span>
              <span>€{sumDetailsItemsTTC().toFixed(2)}</span>
            </div>
            <div class="details-summary-line details-summary-discount">
              <span>
                Ristourne globale
                {#if detailsSale.global_discount_type === "percent"}
                  ({toNumber(detailsSale.global_discount)} %)
                {:else}
                  (montant)
                {/if}
              </span>
              <span
                >–€{Math.max(
                  0,
                  sumDetailsItemsTTC() - toNumber(detailsSale.total_price),
                ).toFixed(2)}</span
              >
            </div>
          {/if}
          <div class="details-total">
            <strong>Total: €{detailsSale.total_price.toFixed(2)}</strong>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<style>
  .page-container {
    min-height: 100vh;
  }

  .page-header {
    background: white;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-header h1 {
    margin: 0;
    color: #333;
    font-size: 1.75rem;
  }

  .page-content {
    padding: 2rem;
  }

  .error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .empty-state {
    background: white;
    padding: 3rem;
    border-radius: 8px;
    text-align: center;
  }

  .empty-state p {
    color: #666;
    margin: 0 0 1rem 0;
  }

  .table-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: #f8f9fa;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #dee2e6;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  .description-text {
    font-size: 0.9rem;
    color: #666;
    cursor: help;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-secondary:hover {
    background: #5a6268;
  }

  .btn-edit {
    padding: 0.4rem 0.8rem;
    background: #ffc107;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-edit:hover:not(:disabled) {
    background: #e0a800;
  }

  .btn-edit:disabled {
    background: #ccc;
    color: #666;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-delete {
    padding: 0.4rem 0.8rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-delete:hover:not(:disabled) {
    background: #c82333;
  }

  .btn-delete:disabled {
    background: #ccc;
    color: #666;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-details {
    padding: 0.4rem 0.8rem;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-details:hover {
    background: #138496;
  }

  .btn-download {
    padding: 0.4rem 0.8rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-download:hover {
    background: #218838;
  }

  form {
    padding: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  label {
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  input,
  select,
  textarea {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #007bff;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
  }

  .section-title {
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .sale-items-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sale-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 0.5rem;
  }

  .sale-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .add-item-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .add-item-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .add-item-row label {
    margin-bottom: 0;
    margin-right: 0.5rem;
    white-space: nowrap;
  }

  .add-item-row select {
    flex: 1;
    min-width: 200px;
  }

  .add-item-row input {
    width: 100px;
  }

  .add-item-row select:last-child {
    min-width: 120px;
  }

  .add-item-row:last-child {
    justify-content: flex-end;
  }

  .btn-add {
    padding: 0.5rem 1rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-add:hover {
    background: #218838;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #dc3545;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 0.5rem;
    line-height: 1;
  }

  .btn-remove:hover {
    color: #c82333;
  }

  .empty-text {
    color: #666;
    font-style: italic;
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem;
  }

  .total-display {
    text-align: right;
    padding: 0.5rem;
    font-size: 1.2rem;
    color: #333;
  }

  .total-display-sub {
    font-size: 0.95rem;
    font-weight: normal;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .global-discount-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .global-discount-row input {
    flex: 1;
    min-width: 6rem;
    max-width: 12rem;
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
  }

  .global-discount-row select {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    min-width: 11rem;
  }

  .field-hint {
    margin: 0.35rem 0 0 0;
    font-size: 0.85rem;
    color: #666;
  }

  .details-summary-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding: 0.35rem 0;
    font-size: 0.95rem;
  }

  .details-summary-discount {
    color: #856404;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .status-select {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    min-width: 120px;
  }

  .status-select:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .status-select.status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-select.status-paid {
    background: #d4edda;
    color: #155724;
  }

  .status-select.status-delivered {
    background: #cce5ff;
    color: #004085;
  }

  .status-select.status-closed {
    background: #e2e3e5;
    color: #383d41;
  }

  .status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-paid {
    background: #d4edda;
    color: #155724;
  }

  .status-cancelled {
    background: #f8d7da;
    color: #721c24;
  }

  .status-delivered {
    background: #cce5ff;
    color: #004085;
  }

  .status-closed {
    background: #e2e3e5;
    color: #383d41;
  }

  select option:disabled {
    color: #999;
    background-color: #f5f5f5;
    font-style: italic;
  }

  /* Details modal styles */
  .details-content {
    padding: 1.5rem;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .details-group {
    display: flex;
    flex-direction: column;
  }

  .details-group.full-width {
    grid-column: 1 / -1;
  }

  .details-group label {
    margin-bottom: 0.5rem;
    color: #666;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .details-group div {
    color: #333;
  }

  .details-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e9ecef;
  }

  .details-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
    font-size: 1.1rem;
  }

  .details-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .details-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .details-item-name {
    flex: 1;
    color: #333;
    font-weight: 500;
  }

  .details-item-details {
    display: flex;
    gap: 1rem;
    align-items: center;
    color: #666;
  }

  .details-item-details strong {
    color: #333;
    font-size: 1rem;
  }

  .details-total {
    text-align: right;
    padding: 0.75rem;
    font-size: 1.2rem;
    color: #333;
    border-top: 2px solid #dee2e6;
    margin-top: 0.5rem;
  }
</style>
