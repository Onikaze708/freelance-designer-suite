export const EDITORIAL_COMPLEXITY_PRICES = {
  baja: 0,
  media: 75,
  alta: 150
};

export const COVER_PRICES = {
  none: 0,
  basic: 180,
  professional: 280,
  premium: 400
};

export const EBOOK_PRICES = {
  none: 0,
  basic: 150,
  optimized: 220
};

export const KDP_PRICES = {
  none: 0,
  basic: 150,
  assisted: 250,
  premium: 350
};

export const METADATA_PRICES = {
  none: 0,
  basic: 80,
  complete: 150
};

export const PRINT_MANAGEMENT_PRICES = {
  none: 0,
  basic: 90,
  complete: 150
};

export const PRINT_MARGIN_TABLE = {
  local_books: { bajo: 0.3, estandar: 0.35, alto: 0.4 },
  international_books: { bajo: 0.4, estandar: 0.5, alto: 0.6 },
  marketing_items: { bajo: 0.25, estandar: 0.3, alto: 0.35 }
};

export function getLayoutRange(pages) {
  const pageCount = Number(pages);
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return { label: '', basePrice: 0, specialQuote: false };
  }
  if (pageCount <= 100) return { label: 'Hasta 100 páginas', basePrice: 350, specialQuote: false };
  if (pageCount <= 200) return { label: '101 a 200 páginas', basePrice: 450, specialQuote: false };
  if (pageCount <= 300) return { label: '201 a 300 páginas', basePrice: 600, specialQuote: false };
  if (pageCount <= 400) return { label: '301 a 400 páginas', basePrice: 800, specialQuote: false };
  return { label: 'Más de 400 páginas', basePrice: 0, specialQuote: true };
}

export function calculateEditorialProject(input) {
  const errors = {};
  const pages = Number(input.pages);
  const providerCost = Number(input.providerCost || 0);

  if (!input.projectTitle?.trim()) {
    errors.projectTitle = 'Ingresa el título o nombre del proyecto.';
  }
  if (!input.clientName?.trim()) {
    errors.clientName = 'Ingresa el nombre del autor o cliente.';
  }
  if (!input.pages && input.pages !== 0) {
    errors.pages = 'Ingresa la cantidad de páginas.';
  } else if (!Number.isFinite(pages) || pages <= 0) {
    errors.pages = 'Las páginas deben ser un número mayor que cero.';
  }
  if (input.includesExternalPrint && (!Number.isFinite(providerCost) || providerCost < 0)) {
    errors.providerCost = 'El costo del proveedor es obligatorio y no puede ser negativo.';
  }

  const layoutRange = getLayoutRange(pages);
  const layoutBase = layoutRange.specialQuote ? 0 : layoutRange.basePrice;
  const complexity = EDITORIAL_COMPLEXITY_PRICES[input.complexity] ?? 0;
  const cover = COVER_PRICES[input.cover] ?? 0;
  const ebook = EBOOK_PRICES[input.ebook] ?? 0;
  const kdp = KDP_PRICES[input.kdp] ?? 0;
  const metadata = METADATA_PRICES[input.metadata] ?? 0;
  const printManagement = PRINT_MANAGEMENT_PRICES[input.printManagement] ?? 0;

  const subtotalEditorial = layoutBase + complexity + cover + ebook + kdp + metadata + printManagement;

  const marginRate = input.includesExternalPrint
    ? PRINT_MARGIN_TABLE[input.printType]?.[input.marginLevel] ?? 0
    : 0;
  const printClientPrice = input.includesExternalPrint ? providerCost * (1 + marginRate) : 0;
  const printProfit = input.includesExternalPrint ? printClientPrice - providerCost : 0;
  const total = subtotalEditorial + printClientPrice;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warning: layoutRange.specialQuote ? 'Este proyecto requiere cotización editorial especial.' : '',
    layoutRange,
    breakdown: {
      maquetacion: layoutBase,
      complejidad: complexity,
      portada: cover,
      ebook,
      kdp,
      metadatos: metadata,
      gestionImpresion: printManagement,
      subtotalEditorial,
      costoProveedor: input.includesExternalPrint ? providerCost : 0,
      margenAplicado: marginRate,
      precioClienteImpresion: printClientPrice,
      gananciaImpresion: printProfit,
      subtotalImpresion: printClientPrice,
      totalFinal: total
    }
  };
}

export function createEditorialQuotePayload(input, result, settings) {
  const items = [
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-layout-${Date.now()}`,
      serviceName: `Maquetación editorial (${result.layoutRange.label || 'Cotización especial'})`,
      quantity: 1,
      unitBasePrice: result.breakdown.maquetacion,
      lineSubtotal: result.breakdown.maquetacion,
      complexityFee: result.breakdown.complejidad,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.maquetacion + result.breakdown.complejidad
    },
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-cover-${Date.now()}`,
      serviceName: 'Portada',
      quantity: 1,
      unitBasePrice: result.breakdown.portada,
      lineSubtotal: result.breakdown.portada,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.portada
    },
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-ebook-${Date.now()}`,
      serviceName: 'Conversión a ebook',
      quantity: 1,
      unitBasePrice: result.breakdown.ebook,
      lineSubtotal: result.breakdown.ebook,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.ebook
    },
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-kdp-${Date.now()}`,
      serviceName: 'Publicación Amazon KDP',
      quantity: 1,
      unitBasePrice: result.breakdown.kdp,
      lineSubtotal: result.breakdown.kdp,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.kdp
    },
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-metadata-${Date.now()}`,
      serviceName: 'Optimización de metadatos',
      quantity: 1,
      unitBasePrice: result.breakdown.metadatos,
      lineSubtotal: result.breakdown.metadatos,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.metadatos
    },
    {
      tempId: crypto.randomUUID(),
      serviceId: `editorial-print-mgmt-${Date.now()}`,
      serviceName: 'Gestión de impresión',
      quantity: 1,
      unitBasePrice: result.breakdown.gestionImpresion,
      lineSubtotal: result.breakdown.gestionImpresion,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.gestionImpresion
    }
  ].filter((item) => item.total > 0);

  if (result.breakdown.precioClienteImpresion > 0) {
    items.push({
      tempId: crypto.randomUUID(),
      serviceId: `editorial-production-${Date.now()}`,
      serviceName: 'Producción e impresión externa',
      quantity: 1,
      unitBasePrice: result.breakdown.precioClienteImpresion,
      lineSubtotal: result.breakdown.precioClienteImpresion,
      complexityFee: 0,
      urgencyFee: 0,
      revisionFee: 0,
      researchFee: 0,
      strategyFee: 0,
      total: result.breakdown.precioClienteImpresion
    });
  }

  return {
    clientId: null,
    clientSnapshot: {
      name: input.clientName,
      businessName: input.projectTitle,
      email: '',
      phone: ''
    },
    date: new Date().toISOString().slice(0, 10),
    discountType: 'fixed',
    discountValue: 0,
    applyTax: false,
    taxRate: settings.taxPercentage || 0,
    paymentTerms: settings.paymentTerms,
    deliveryEstimate: settings.deliveryEstimate,
    notes: [
      `Proyecto editorial: ${input.projectTitle}`,
      `Autor o cliente: ${input.clientName}`,
      `Páginas: ${input.pages}`,
      result.warning || '',
      input.includesExternalPrint ? `Costo proveedor: ${result.breakdown.costoProveedor} | Margen: ${Math.round(result.breakdown.margenAplicado * 100)}% | Ganancia impresión: ${result.breakdown.gananciaImpresion}` : 'Sin impresión externa'
    ].filter(Boolean).join(' | '),
    items,
    totals: {
      subtotal: result.breakdown.subtotalEditorial + result.breakdown.subtotalImpresion,
      extras: 0,
      discount: 0,
      taxes: 0,
      total: result.breakdown.totalFinal
    },
    status: 'draft'
  };
}
