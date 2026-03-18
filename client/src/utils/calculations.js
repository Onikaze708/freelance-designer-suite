export const CATEGORY_OPTIONS = [
  "Identidad visual",
  "Redes sociales",
  "Publicidad y marketing",
  "Diseño editorial",
  "Diseño web",
  "Diseño corporativo",
  "Photography",
  "Monthly Creative Plans"
];

export const SERVICE_OPTION_LABELS = {
  cantidad: "Cantidad",
  complejidad: "Complejidad",
  urgencia: "Urgencia",
  revisiones: "Revisiones",
  investigacion: "Investigación",
  estrategia: "Estrategia"
};

export const COMPLEXITY_OPTIONS = [
  { value: "basic", label: "Básica" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" }
];

export const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgente" },
  { value: "veryUrgent", label: "Muy urgente" }
];

export const INVOICE_STATUSES = ["draft", "sent", "pending", "paid", "overdue"];

export function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("es-US", { style: "currency", currency }).format(Number(value || 0));
}

function toSafeNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function clampNumber(value, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMoney(value) {
  return Math.round((toSafeNumber(value) + Number.EPSILON) * 100) / 100;
}

export function getServiceBasePrice(service) {
  return toSafeNumber(service.base_price ?? service.basePrice ?? 0);
}

export function getServiceUnit(service) {
  return service.unit ?? service.billingUnit ?? "proyecto";
}

export function serviceHasOption(service, option) {
  return Array.isArray(service.options) ? service.options.includes(option) : false;
}

export function getServiceOptions(service) {
  return Array.isArray(service.options) ? service.options : [];
}

function feeAmount(baseAmount, feeConfig, enabled) {
  if (!enabled) return 0;
  if (feeConfig.mode === "fixed") return toSafeNumber(feeConfig.value);
  return toSafeNumber(baseAmount) * (toSafeNumber(feeConfig.value) / 100);
}

export function calculateLineItem(item, service, settings) {
  const quantity = serviceHasOption(service, "cantidad") ? Math.max(1, toSafeNumber(item.quantity || 1)) : 1;
  const base = getServiceBasePrice(service) * quantity;
  const complexityRate = serviceHasOption(service, "complejidad") ? toSafeNumber(settings.complexityRates[item.complexity] || 0) : 0;
  const urgencyRate = serviceHasOption(service, "urgencia") ? toSafeNumber(settings.urgencyRates[item.urgency] || 0) : 0;
  const complexityFee = base * complexityRate;
  const urgencyFee = base * urgencyRate;
  const included = toSafeNumber(settings.revisionSettings.includedRevisions || 1);
  const revisions = serviceHasOption(service, "revisiones") ? toSafeNumber(item.revisions || included) : included;
  const extraRevisions = Math.max(0, revisions - included);
  const revisionFee = extraRevisions * toSafeNumber(settings.revisionSettings.extraRevisionCost || 0);
  const subtotalBeforeFlags = base + complexityFee + urgencyFee + revisionFee;
  const researchFee = serviceHasOption(service, "investigacion") ? feeAmount(subtotalBeforeFlags, settings.researchFee, item.includesResearch) : 0;
  const strategyFee = serviceHasOption(service, "estrategia") ? feeAmount(subtotalBeforeFlags, settings.strategyFee, item.includesStrategy) : 0;
  const total = subtotalBeforeFlags + researchFee + strategyFee;

  return {
    ...item,
    quantity,
    complexityFee: roundMoney(complexityFee),
    urgencyFee: roundMoney(urgencyFee),
    revisionFee: roundMoney(revisionFee),
    researchFee: roundMoney(researchFee),
    strategyFee: roundMoney(strategyFee),
    unitBasePrice: roundMoney(getServiceBasePrice(service)),
    lineSubtotal: roundMoney(base),
    total: roundMoney(total)
  };
}

export function calculateQuoteTotals(items, services, settings, options) {
  const enrichedItems = items.map((item) => {
    const service = services.find((entry) => entry.id === item.serviceId);
    return service ? { ...calculateLineItem(item, service, settings), serviceName: service.name } : item;
  });

  const subtotal = roundMoney(enrichedItems.reduce((sum, item) => sum + toSafeNumber(item.lineSubtotal || 0), 0));
  const extras = roundMoney(enrichedItems.reduce((sum, item) => {
    return sum + toSafeNumber(item.complexityFee || 0) + toSafeNumber(item.urgencyFee || 0) + toSafeNumber(item.revisionFee || 0) + toSafeNumber(item.researchFee || 0) + toSafeNumber(item.strategyFee || 0);
  }, 0));

  const grossTotal = roundMoney(Math.max(0, subtotal + extras));
  const discountType = options?.discountType === "fixed" ? "fixed" : "percent";
  const rawDiscountValue = clampNumber(toSafeNumber(options?.discountValue), 0);
  const normalizedDiscountValue = discountType === "percent" ? clampNumber(rawDiscountValue, 0, 100) : rawDiscountValue;
  const rawDiscountAmount = discountType === "percent" ? grossTotal * (normalizedDiscountValue / 100) : normalizedDiscountValue;
  const discount = roundMoney(clampNumber(rawDiscountAmount, 0, grossTotal));
  const taxableBase = roundMoney(clampNumber(grossTotal - discount, 0));
  const taxRate = clampNumber(toSafeNumber(options?.taxRate), 0);
  const taxes = options?.applyTax ? roundMoney(Math.max(0, taxableBase * (taxRate / 100))) : 0;
  const total = roundMoney(Math.max(0, taxableBase + taxes));

  return {
    items: enrichedItems,
    totals: {
      subtotal,
      extras,
      discount,
      discountAmount: discount,
      taxes,
      total
    },
    meta: {
      grossTotal,
      discountType,
      discountValue: normalizedDiscountValue,
      taxableBase
    }
  };
}

export function createEmptyQuoteItem(service) {
  return {
    tempId: crypto.randomUUID(),
    serviceId: service.id,
    quantity: 1,
    complexity: "basic",
    urgency: "normal",
    revisions: 1,
    includesResearch: false,
    includesStrategy: false
  };
}

