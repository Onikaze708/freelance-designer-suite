import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./calculations";

function studioName(settings) {
  return settings.businessName || settings.designerName || "Miami Creative Lab";
}

function clientName(clientSnapshot) {
  return clientSnapshot?.businessName || clientSnapshot?.name || "Cliente";
}

export function exportQuotePdf(quote, settings) {
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Cotización", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(studioName(settings), 14, 28);
  doc.text([settings.email, settings.phone, settings.address].filter(Boolean).join(" | "), 14, 34);

  doc.text(`No. ${quote.quoteNumber}`, 150, 20);
  doc.text(`Fecha: ${quote.date}`, 150, 28);
  doc.text(`Cliente: ${clientName(quote.clientSnapshot)}`, 14, 48);
  doc.text(`Contacto: ${quote.clientSnapshot?.name || "-"}`, 14, 56);

  autoTable(doc, {
    startY: 66,
    head: [["Servicio", "Cant.", "Unitario", "Extras", "Total"]],
    body: quote.items.map((item) => [
      item.serviceName,
      String(item.quantity),
      formatCurrency(item.unitBasePrice, settings.currency),
      formatCurrency(
        item.complexityFee + item.urgencyFee + item.revisionFee + item.researchFee + item.strategyFee,
        settings.currency
      ),
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
