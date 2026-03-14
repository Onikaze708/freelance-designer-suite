export const PRODUCTION_MARGIN_PRESETS = {
  bajo: 0.25,
  estandar: 0.3,
  alto: 0.35,
  premium: 0.4
};

export const PRODUCTION_CATEGORIES = [
  'business cards',
  'flyers',
  'brochures',
  'posters',
  'trípticos',
  'agendas',
  'lapiceros',
  'material promocional',
  'otros'
];

export function calculateProductionProject(input) {
  const errors = {};
  const quantity = Number(input.quantity);
  const providerCost = Number(input.providerCost);
  const marginPercent = Number(input.marginPercent);

  if (!input.productName?.trim()) {
    errors.productName = 'Ingresa el nombre del producto.';
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    errors.quantity = 'La cantidad no puede ser menor que 1.';
  }
  if (!Number.isFinite(providerCost) || providerCost < 0) {
    errors.providerCost = 'El costo proveedor no puede ser negativo.';
  }
  if (!Number.isFinite(marginPercent) || marginPercent < 0) {
    errors.marginPercent = 'El margen no puede ser negativo.';
  }

  const marginRate = Number.isFinite(marginPercent) ? marginPercent / 100 : 0;
  const finalPrice = Number.isFinite(providerCost) ? providerCost * (1 + marginRate) : 0;
  const profit = finalPrice - (Number.isFinite(providerCost) ? providerCost : 0);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    breakdown: {
      quantity: Number.isFinite(quantity) ? quantity : 0,
      costoProveedor: Number.isFinite(providerCost) ? providerCost : 0,
      margenAplicado: marginRate,
      margenPorcentaje: Number.isFinite(marginPercent) ? marginPercent : 0,
      ganancia: profit,
      precioFinalCliente: finalPrice
    }
  };
}

export function createProductionQuotePayload(input, result, settings) {
  const serviceName = `${input.productName} (${input.category})`;
  return {
    clientId: null,
    clientSnapshot: {
      name: input.productName,
      businessName: input.category,
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
      `Producto: ${input.productName}`,
      `Categoría: ${input.category}`,
      `Cantidad: ${input.quantity}`,
      `Costo proveedor: ${result.breakdown.costoProveedor}`,
      `Margen aplicado: ${result.breakdown.margenPorcentaje}%`,
      input.notes || ''
    ].filter(Boolean).join(' | '),
    items: [
      {
        tempId: crypto.randomUUID(),
        serviceId: `production-${Date.now()}`,
        serviceName,
        quantity: 1,
        unitBasePrice: result.breakdown.precioFinalCliente,
        lineSubtotal: result.breakdown.precioFinalCliente,
        complexityFee: 0,
        urgencyFee: 0,
        revisionFee: 0,
        researchFee: 0,
        strategyFee: 0,
        total: result.breakdown.precioFinalCliente
      }
    ],
    totals: {
      subtotal: result.breakdown.precioFinalCliente,
      extras: 0,
      discount: 0,
      taxes: 0,
      total: result.breakdown.precioFinalCliente
    },
    status: 'draft'
  };
}
