import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./calculations";

function documentHeader(doc, title, business) {
  doc.setFontSize(22);
  doc.text(title, 14, 20);
  doc.setFontSize(11);
  doc.text(business.businessName || business.designerName || "Tu estudio", 14, 28);
  doc.text([business.email, business.phone, business.address].filter(Boolean).join(" | "), 14, 34);
}

export function exportQuotePdf(quote, settings) {
  const doc = new jsPDF();
  documentHeader(doc, "Cotizacion", settings);
  doc.text(`No. ${quote.quoteNumber}`, 150, 20);
  doc.text(`Fecha: ${quote.date}`, 150, 28);
  doc.text(`Cliente: ${quote.clientSnapshot.businessName || quote.clientSnapshot.name}`, 14, 48);
  doc.text(`Contacto: ${quote.clientSnapshot.name}`, 14, 56);

  autoTable(doc, {
    startY: 66,
    head: [["Servicio", "Cant.", "Unitario", "Extras", "Total"]],
    body: quote.items.map((item) => [
      item.serviceName,
      String(item.quantity),
      formatCurrency(item.unitBasePrice, settings.currency),
      formatCurrency(item.complexityFee + item.urgencyFee + item.revisionFee + item.researchFee + item.strategyFee, settings.currency),
      formatCurrency(item.total, settings.currency)
    ])
  });

  const endY = doc.lastAutoTable.finalY + 12;
  doc.text(`Subtotal: ${formatCurrency(quote.totals.subtotal, settings.currency)}`, 135, endY);
  doc.text(`Extras: ${formatCurrency(quote.totals.extras, settings.currency)}`, 135, endY + 8);
  doc.text(`Descuento: ${formatCurrency(quote.totals.discount, settings.currency)}`, 135, endY + 16);
  doc.text(`Impuestos: ${formatCurrency(quote.totals.taxes, settings.currency)}`, 135, endY + 24);
  doc.setFontSize(14);
  doc.text(`Total: ${formatCurrency(quote.totals.total, settings.currency)}`, 135, endY + 36);
  doc.setFontSize(11);
  doc.text(`Condiciones de pago: ${quote.paymentTerms || settings.paymentTerms}`, 14, endY + 52, { maxWidth: 180 });
  doc.text(`Entrega estimada: ${quote.deliveryEstimate || settings.deliveryEstimate}`, 14, endY + 66, { maxWidth: 180 });
  doc.text(`Notas: ${quote.notes || "-"}`, 14, endY + 80, { maxWidth: 180 });
  doc.text(settings.quoteClosingMessage || "", 14, endY + 96, { maxWidth: 180 });
  doc.save(`${quote.quoteNumber}.pdf`);
}

export function exportInvoicePdf(invoice, settings) {
  const doc = new jsPDF();
  documentHeader(doc, "Factura", settings);
  doc.text(`No. ${invoice.invoiceNumber}`, 150, 20);
  doc.text(`Fecha: ${invoice.issueDate}`, 150, 28);
  doc.text(`Cliente: ${invoice.clientSnapshot.businessName || invoice.clientSnapshot.name}`, 14, 48);

  autoTable(doc, {
    startY: 60,
    head: [["Servicio", "Cant.", "Unitario", "Total"]],
    body: invoice.items.map((item) => [item.serviceName, String(item.quantity), formatCurrency(item.unitBasePrice, settings.currency), formatCurrency(item.total, settings.currency)])
  });

  const endY = doc.lastAutoTable.finalY + 12;
  doc.text(`Total: ${formatCurrency(invoice.totals.total, settings.currency)}`, 145, endY);
  doc.text(`Estado: ${invoice.status}`, 145, endY + 10);
  doc.text(`Metodo: ${invoice.paymentMethod || "PayPal"}`, 145, endY + 20);
  doc.text(`Pago: ${invoice.paypalLink || settings.paypalLink || "-"}`, 14, endY + 38, { maxWidth: 180 });
  doc.text(settings.invoiceClosingMessage || "", 14, endY + 54, { maxWidth: 180 });
  doc.save(`${invoice.invoiceNumber}.pdf`);
}