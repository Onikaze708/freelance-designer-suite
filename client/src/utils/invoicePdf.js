import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoMainUrl from "../assets/logo-main.png";
import { formatCurrency } from "./calculations";

const BRAND_NAME = "Miami Creative Lab";
const BRAND_SUBTITLE = "Creative Design Studio";
const COLORS = {
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  border: [226, 232, 240],
  panel: [248, 250, 252],
  accent: [5, 150, 105],
  white: [255, 255, 255]
};

let cachedLogoPromise;

function studioName(settings) {
  return settings.businessName || BRAND_NAME;
}

function studioSubtitle(settings) {
  return settings.studioSubtitle || BRAND_SUBTITLE;
}

function clientPrimaryName(clientSnapshot) {
  return clientSnapshot?.businessName || clientSnapshot?.name || "Cliente";
}

function formatDisplayDate(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("es-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function normalizeFilePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function invoiceFileName(invoice) {
  const client = normalizeFilePart(clientPrimaryName(invoice.clientSnapshot));
  const number = normalizeFilePart(invoice.invoiceNumber || "001");
  return `factura-${client || "cliente"}-${number}.pdf`;
}

function buildPaypalPaymentLink(invoice, settings) {
  const baseLink = (invoice.paypalLink || settings.paypalLink || "").trim().replace(/\/$/, "");
  if (!baseLink) {
    return "";
  }

  const total = Number(invoice.totals?.total || 0);
  if (total > 0) {
    return `${baseLink}/${total.toFixed(2)}`;
  }

  return baseLink;
}

async function getLogoDataUrl() {
  if (!cachedLogoPromise) {
    cachedLogoPromise = fetch(logoMainUrl)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }

  return cachedLogoPromise;
}

async function buildQrDataUrl(paymentLink) {
  if (!paymentLink) {
    return "";
  }

  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toDataURL(paymentLink, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF"
      }
    });
  } catch (_error) {
    return "";
  }
}

function drawTopAccent(doc) {
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, 210, 7, "F");
}

async function drawHeader(doc, invoice, settings) {
  drawTopAccent(doc);

  const logoDataUrl = await getLogoDataUrl();
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 14, 52, 15);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...COLORS.ink);
  doc.text(studioName(settings), 14, 37);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(studioSubtitle(settings), 14, 43);

  const contactLines = [settings.email, settings.phone].filter(Boolean);
  if (contactLines.length > 0) {
    doc.text(contactLines.join("  |  "), 14, 49);
  }

  doc.setFillColor(...COLORS.panel);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(134, 14, 62, 33, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("FACTURA", 191, 24, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(invoice.invoiceNumber || "Sin número", 191, 31, { align: "right" });
  doc.text(`Emitida: ${formatDisplayDate(invoice.issueDate)}`, 191, 37, { align: "right" });
  doc.text(`Vence: ${formatDisplayDate(invoice.dueDate || invoice.issueDate)}`, 191, 43, { align: "right" });

  doc.setDrawColor(...COLORS.border);
  doc.line(14, 58, 196, 58);
}

function drawInfoCard(doc, title, lines, x, y, width) {
  const safeLines = lines.filter(Boolean);
  const height = Math.max(24, 14 + safeLines.length * 5.5 + 6);

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.accent);
  doc.text(title.toUpperCase(), x + 4, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(safeLines, x + 4, y + 16);

  return height;
}

function buildInvoiceRows(invoice, currency) {
  return invoice.items.map((item) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitBasePrice || 0);
    const lineTotal = Number(item.total || quantity * unitPrice);

    return [
      item.serviceName,
      String(quantity),
      formatCurrency(unitPrice, currency),
      formatCurrency(lineTotal, currency)
    ];
  });
}

function drawItemsTable(doc, invoice, settings, startY) {
  autoTable(doc, {
    startY,
    margin: { left: 14, right: 14 },
    head: [["Servicio", "Cantidad", "Precio unitario", "Subtotal"]],
    body: buildInvoiceRows(invoice, settings.currency),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 4,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      textColor: COLORS.ink,
      valign: "middle"
    },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.white,
      fontStyle: "bold",
      lineColor: COLORS.accent,
      lineWidth: 0.2
    },
    bodyStyles: {
      fillColor: COLORS.white
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253]
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 36, halign: "right" },
      3: { cellWidth: 36, halign: "right" }
    }
  });

  return doc.lastAutoTable.finalY;
}

function drawTotalsCard(doc, invoice, settings, x, y, width) {
  const lineItems = [
    { label: "Subtotal", value: Number(invoice.totals?.subtotal || 0) },
    { label: "Extras", value: Number(invoice.totals?.extras || 0) },
    { label: "Impuestos", value: Number(invoice.totals?.taxes || 0) }
  ];

  const discount = Number(invoice.totals?.discount || 0);
  if (discount > 0) {
    lineItems.splice(2, 0, { label: "Descuento", value: -discount });
  }

  const height = 14 + lineItems.length * 8 + 16;
  doc.setFillColor(...COLORS.panel);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text("Resumen", x + 5, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);

  lineItems.forEach((item, index) => {
    const rowY = y + 18 + index * 8;
    doc.text(item.label, x + 5, rowY);
    doc.text(formatCurrency(item.value, settings.currency), x + width - 5, rowY, { align: "right" });
  });

  const dividerY = y + 18 + lineItems.length * 8 - 3;
  doc.setDrawColor(...COLORS.border);
  doc.line(x + 5, dividerY, x + width - 5, dividerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.ink);
  doc.text("Total", x + 5, y + height - 8);
  doc.text(formatCurrency(invoice.totals?.total || 0, settings.currency), x + width - 5, y + height - 8, { align: "right" });
}

function drawNotesSection(doc, invoice, settings, startY) {
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, startY, 101, 50, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.accent);
  doc.text("CONDICIONES DE PAGO", 18, startY + 8);
  doc.text("NOTAS", 18, startY + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(invoice.paymentTerms || settings.paymentTerms || "-", 18, startY + 15, { maxWidth: 93 });
  doc.text(invoice.notes || "Sin notas adicionales.", 18, startY + 35, { maxWidth: 93 });
}

function drawPaymentOptionsCard(doc, paymentLink, qrDataUrl, startY) {
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(123, startY, 73, 70, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.accent);
  doc.text("OPCIONES DE PAGO", 127, startY + 8);

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 137, startY + 12, 44, 44);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(paymentLink || "Agrega un enlace PayPal en configuración.", 127, startY + 62, { maxWidth: 65 });
}

function drawFooter(doc, invoice, settings) {
  doc.setDrawColor(...COLORS.border);
  doc.line(14, 279, 196, 279);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const footerLeft = settings.invoiceClosingMessage || "Gracias por confiar en Miami Creative Lab.";
  const footerRight = invoice.paymentMethod || "PayPal";
  doc.text(footerLeft, 14, 285, { maxWidth: 112 });
  doc.text(footerRight || "", 196, 285, { align: "right", maxWidth: 70 });
}

export function createInvoiceEmailLink(invoice, settings) {
  const recipient = invoice.clientSnapshot?.email || "";
  const subject = encodeURIComponent(`Factura ${invoice.invoiceNumber || ""} - ${studioName(settings)}`);
  const body = encodeURIComponent(
    [
      `Hola ${invoice.clientSnapshot?.name || clientPrimaryName(invoice.clientSnapshot)},`,
      "",
      `Te comparto la factura ${invoice.invoiceNumber || ""} correspondiente a tu proyecto.`,
      `Total: ${formatCurrency(invoice.totals?.total || 0, settings.currency)}`,
      "",
      "Adjunto el PDF generado desde el sistema.",
      "",
      "Gracias,",
      studioName(settings)
    ].join("\n")
  );

  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}

export async function exportInvoicePdf(invoice, settings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const paymentLink = buildPaypalPaymentLink(invoice, settings);
  const qrDataUrl = await buildQrDataUrl(paymentLink);

  await drawHeader(doc, invoice, settings);

  const billingCardHeight = drawInfoCard(
    doc,
    "Facturar a",
    [
      clientPrimaryName(invoice.clientSnapshot),
      invoice.clientSnapshot?.name,
      invoice.clientSnapshot?.email,
      invoice.clientSnapshot?.phone
    ],
    14,
    66,
    88
  );

  drawInfoCard(
    doc,
    "Factura",
    [
      `Número: ${invoice.invoiceNumber || "-"}`,
      `Fecha de emisión: ${formatDisplayDate(invoice.issueDate)}`,
      `Fecha de vencimiento: ${formatDisplayDate(invoice.dueDate || invoice.issueDate)}`
    ],
    108,
    66,
    88
  );

  const tableStartY = 66 + Math.max(billingCardHeight, 32) + 12;
  const tableEndY = drawItemsTable(doc, invoice, settings, tableStartY);
  const totalsY = tableEndY + 10;

  drawTotalsCard(doc, invoice, settings, 123, totalsY, 73);
  drawNotesSection(doc, invoice, settings, totalsY + 54);
  drawPaymentOptionsCard(doc, paymentLink, qrDataUrl, totalsY + 54);
  drawFooter(doc, invoice, settings);

  doc.save(invoiceFileName(invoice));
}
